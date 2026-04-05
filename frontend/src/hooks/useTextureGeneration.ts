import { useCallback, useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";

const API_BASE = "/api";
const POLL_INTERVAL = 2000;
const DEBOUNCE_MS = 1000;

/**
 * Compute a simple hash of the spec fields that affect textures.
 * Matches the backend's compute_spec_hash logic (same fields, sorted keys).
 */
async function computeSpecHash(spec: {
  material: string;
  style: string;
  building_type: string;
  roof_style: string;
}): Promise<string> {
  const keyFields = {
    building_type: spec.building_type,
    material: spec.material,
    roof_style: spec.roof_style,
    style: spec.style,
  };
  const data = new TextEncoder().encode(JSON.stringify(keyFields));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/**
 * Hook that manages the texture generation lifecycle:
 * 1. On buildingSpec change, POST to start generation
 * 2. Poll status until textures_ready
 * 3. Set texture URLs in the store
 */
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
        const res = await fetch(`${API_BASE}/generate/textures/${pid}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.textures_ready) {
          stopPolling();
          setTextureStatus("ready");
          setTextureSpecHash(hash);
          setTextureUrls({
            wall: `${API_BASE}/generate/textures/${pid}/wall?h=${hash}`,
            roof: `${API_BASE}/generate/textures/${pid}/roof?h=${hash}`,
            door: `${API_BASE}/generate/textures/${pid}/door?h=${hash}`,
            trim: `${API_BASE}/generate/textures/${pid}/trim?h=${hash}`,
          });
        }

        // Check for errors
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

      // Skip if hash matches what we already have
      if (hash === textureSpecHash) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      stopPolling();

      const controller = new AbortController();
      abortRef.current = controller;

      setTextureStatus("generating");

      try {
        const res = await fetch(`${API_BASE}/generate/textures/${projectId}`, {
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
          // Textures already exist — set URLs immediately
          setTextureStatus("ready");
          setTextureSpecHash(hash);
          setTextureUrls({
            wall: `${API_BASE}/generate/textures/${projectId}/wall?h=${hash}`,
            roof: `${API_BASE}/generate/textures/${projectId}/roof?h=${hash}`,
            door: `${API_BASE}/generate/textures/${projectId}/door?h=${hash}`,
            trim: `${API_BASE}/generate/textures/${projectId}/trim?h=${hash}`,
          });
          return;
        }

        // Start polling
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
  }, [buildingSpec, projectId, textureSpecHash, setTextureStatus, setTextureSpecHash, setTextureUrls, stopPolling, pollStatus]);
}
