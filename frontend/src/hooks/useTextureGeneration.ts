import { useCallback, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { useProjectStore } from "../store/projectStore";
import type { BuildingSpec, PbrTextureUrls } from "../store/projectStore";

const API_BASE = "/api";
const POLL_INTERVAL = 2000;
const DEBOUNCE_MS = 1000;
const PARTS = ["wall", "roof", "door", "trim"] as const;

function buildPbrUrls(projectId: string, hash: string): PbrTextureUrls {
  const urls: PbrTextureUrls = {};
  for (const part of PARTS) {
    urls[part] = {
      albedo: `${API_BASE}/generate/textures/${projectId}/${part}/albedo?h=${hash}`,
      normal: `${API_BASE}/generate/textures/${projectId}/${part}/normal?h=${hash}`,
      roughness: `${API_BASE}/generate/textures/${projectId}/${part}/roughness?h=${hash}`,
      ao: `${API_BASE}/generate/textures/${projectId}/${part}/ao?h=${hash}`,
    };
  }
  return urls;
}

/**
 * Mirrors backend compute_spec_hash: includes material, style, building_type,
 * roof_style, and per-surface material overrides.
 */
async function computeSpecHash(spec: BuildingSpec): Promise<string> {
  const sm = spec.surface_materials ?? {};
  const keyFields = {
    building_type: spec.building_type,
    material: spec.material,
    roof_style: spec.roof_style,
    style: spec.style,
    surface: {
      wall: sm.wall ?? null,
      roof: sm.roof ?? null,
      trim: sm.trim ?? null,
      door: sm.door ?? null,
    },
  };
  const data = new TextEncoder().encode(JSON.stringify(keyFields));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export function useTextureGeneration() {
  const buildingSpec = useProjectStore((s) => s.buildingSpec);
  const projectId = useProjectStore((s) => s.projectId);
  const textureSpecHash = useProjectStore((s) => s.textureSpecHash);
  const setTextureStatus = useProjectStore((s) => s.setTextureStatus);
  const setTextureSpecHash = useProjectStore((s) => s.setTextureSpecHash);
  const setTextureUrls = useProjectStore((s) => s.setTextureUrls);

  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }
  }, []);

  const pollStatus = useCallback(
    async (pid: string, hash: string) => {
      try {
        const res = await apiFetch(`${API_BASE}/generate/textures/${pid}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.textures_ready) {
          stopPolling();
          setTextureStatus("ready");
          setTextureSpecHash(hash);
          setTextureUrls(buildPbrUrls(pid, hash));
        }

        if (data.stages?.some((s: { status: string }) => s.status === "error")) {
          stopPolling();
          setTextureStatus("error");
        }
      } catch {
        // Network error — keep polling
      }
    },
    [stopPolling, setTextureStatus, setTextureSpecHash, setTextureUrls],
  );

  useEffect(() => {
    if (!buildingSpec || !projectId) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const hash = await computeSpecHash(buildingSpec);
      if (hash === textureSpecHash) return;

      abortRef.current?.abort();
      stopPolling();

      const controller = new AbortController();
      abortRef.current = controller;

      setTextureStatus("generating");

      try {
        const res = await apiFetch(`${API_BASE}/generate/textures/${projectId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildingSpec),
          signal: controller.signal,
        });

        if (!res.ok && res.status !== 409) {
          setTextureStatus("error");
          return;
        }

        const data = await res.json();

        if (data.status === "cached") {
          setTextureStatus("ready");
          setTextureSpecHash(hash);
          setTextureUrls(buildPbrUrls(projectId, hash));
          return;
        }

        pollRef.current = setInterval(() => pollStatus(projectId, hash), POLL_INTERVAL);
      } catch {
        // Aborted or network error
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      stopPolling();
    };
  }, [
    buildingSpec,
    projectId,
    textureSpecHash,
    setTextureStatus,
    setTextureSpecHash,
    setTextureUrls,
    stopPolling,
    pollStatus,
  ]);
}
