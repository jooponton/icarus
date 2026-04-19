import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { apiBlobUrl, apiFetch } from "../lib/api";
import { useProjectStore } from "../store/projectStore";
import type { BuildingSpec } from "../store/projectStore";

const YAW_STEP = 15;
const DEBOUNCE_MS = 200;
// Neighbor angles to pre-fetch after the current yaw is satisfied, so orbiting
// into an adjacent bucket is instant. ±15° and ±30° covers a smooth drag.
const PREFETCH_OFFSETS = [15, -15, 30, -30];

function quantizeYaw(yawDeg: number): number {
  const normalized = ((yawDeg % 360) + 360) % 360;
  return (Math.round(normalized / YAW_STEP) * YAW_STEP) % 360;
}

function wrapYaw(yaw: number): number {
  return ((yaw % 360) + 360) % 360;
}

interface Props {
  spec: BuildingSpec;
}

/**
 * Photorealistic building impostor. Tracks the orbit camera's yaw relative to
 * the building, quantizes to 15° buckets, and fetches a Gemini render for the
 * current angle. Renders are cached per (spec_hash, yaw) on the backend and
 * per-yaw in-memory here so revisiting angles is instant. On every resolved
 * angle we also kick off pre-fetches for the neighboring buckets so a slow
 * drag stays smooth.
 *
 * The plane is billboarded so it always faces the camera horizontally while
 * staying vertical, and sized to contain the building's bounding volume.
 */
export default function BuildingBillboard({ spec }: Props) {
  const cameraPose = useProjectStore((s) => s.cameraPose);
  const projectId = useProjectStore((s) => s.projectId);
  const backgroundImageUrl = useProjectStore((s) => s.backgroundImageUrl);
  const placement = useProjectStore((s) => s.buildingPlacement);

  const photoFilename = useMemo(() => {
    if (!backgroundImageUrl) return null;
    return backgroundImageUrl.split("/").pop() ?? null;
  }, [backgroundImageUrl]);

  const [currentYaw, setCurrentYaw] = useState(0);
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const inflightRef = useRef<Set<number>>(new Set());
  const pendingYaw = useRef<number | null>(null);

  useFrame(({ camera }) => {
    const dx = camera.position.x - placement.position[0];
    const dz = camera.position.z - placement.position[2];
    const worldYaw = (Math.atan2(dx, dz) * 180) / Math.PI;
    const localYaw = worldYaw - (placement.rotation[1] * 180) / Math.PI;
    const quantized = quantizeYaw(localYaw);
    if (quantized !== currentYaw) {
      setCurrentYaw(quantized);
    }
  });

  const fetchYaw = useCallback(
    async (yaw: number): Promise<string | null> => {
      if (!projectId || !photoFilename || !cameraPose) return null;
      const cached = cacheRef.current.get(yaw);
      if (cached) return cached;
      if (inflightRef.current.has(yaw)) return null;

      inflightRef.current.add(yaw);
      try {
        const r = await apiFetch("/api/building/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            spec,
            yaw_deg: yaw,
            photo_filename: photoFilename,
            pitch_deg: cameraPose.pitch_deg,
          }),
        });
        if (!r.ok) throw new Error(`render ${r.status}`);
        const data = await r.json();
        cacheRef.current.set(yaw, data.url);
        return data.url;
      } catch (err) {
        console.error("[BuildingBillboard] render failed:", err);
        return null;
      } finally {
        inflightRef.current.delete(yaw);
      }
    },
    [projectId, photoFilename, cameraPose, spec],
  );

  const prefetchNeighbors = useCallback(
    (yaw: number) => {
      for (const offset of PREFETCH_OFFSETS) {
        const target = wrapYaw(yaw + offset);
        if (cacheRef.current.has(target) || inflightRef.current.has(target)) continue;
        // Fire-and-forget; populates the cache, doesn't touch textureUrl.
        void fetchYaw(target);
      }
    },
    [fetchYaw],
  );

  useEffect(() => {
    if (!projectId || !photoFilename || !cameraPose) return;

    const cached = cacheRef.current.get(currentYaw);
    if (cached) {
      setTextureUrl(cached);
      setLoading(false);
      prefetchNeighbors(currentYaw);
      return;
    }

    pendingYaw.current = currentYaw;
    setLoading(true);
    const timeout = setTimeout(async () => {
      if (pendingYaw.current !== currentYaw) return;
      const url = await fetchYaw(currentYaw);
      if (pendingYaw.current !== currentYaw) return;
      if (url) setTextureUrl(url);
      setLoading(false);
      prefetchNeighbors(currentYaw);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [currentYaw, projectId, photoFilename, cameraPose, fetchYaw, prefetchNeighbors]);

  // The render endpoint is JWT-gated, so `TextureLoader` can't fetch it
  // directly. Pull the image through `apiBlobUrl` and feed the blob: URL to
  // three's loader, then revoke on unmount / URL change.
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!textureUrl) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    let blobUrl: string | null = null;
    let createdTex: THREE.Texture | null = null;
    (async () => {
      try {
        blobUrl = await apiBlobUrl(textureUrl);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        const loader = new THREE.TextureLoader();
        const tex = loader.load(blobUrl);
        tex.colorSpace = THREE.SRGBColorSpace;
        createdTex = tex;
        if (!cancelled) setTexture(tex);
      } catch (err) {
        console.error("[BuildingBillboard] texture load failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      createdTex?.dispose();
    };
  }, [textureUrl]);

  // Size the plane to enclose the building's bounding volume with a margin.
  // `width` uses the footprint diagonal so any viewing angle fits.
  const width = Math.hypot(spec.footprint_width, spec.footprint_depth) * 1.3;
  const height = spec.stories * 3.5 + 5;

  const showLoadingBadge = loading && !texture;

  return (
    <Billboard
      position={[0, height / 2, 0]}
      follow
      lockX
      lockZ
    >
      {texture && (
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.01}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {showLoadingBadge && (
        <Html center distanceFactor={20} style={{ pointerEvents: "none" }}>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              background: "rgba(0,0,0,0.7)",
              color: "white",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            Rendering building…
          </div>
        </Html>
      )}
    </Billboard>
  );
}
