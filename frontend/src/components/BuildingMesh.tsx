import { useEffect, useMemo, useState } from "react";
import { useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { apiBlobUrl, apiFetch } from "../lib/api";
import { useProjectStore } from "../store/projectStore";
import type { BuildingSpec } from "../store/projectStore";

interface Props {
  spec: BuildingSpec;
}

interface MeshState {
  url: string;
  specHash: string;
}

/**
 * Photorealistic 3D building. Sends the spec to the backend which renders a
 * front-facing Gemini image and feeds it to Trellis on fal.ai to produce a
 * GLB mesh. The mesh is cached server-side by spec hash so resubmitting the
 * same spec returns instantly.
 */
export default function BuildingMesh({ spec }: Props) {
  const projectId = useProjectStore((s) => s.projectId);
  const backgroundImageUrl = useProjectStore((s) => s.backgroundImageUrl);
  const cameraPose = useProjectStore((s) => s.cameraPose);

  const photoFilename = useMemo(() => {
    if (!backgroundImageUrl) return null;
    return backgroundImageUrl.split("/").pop() ?? null;
  }, [backgroundImageUrl]);

  const [mesh, setMesh] = useState<MeshState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !photoFilename || !cameraPose) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const r = await apiFetch("/api/building/mesh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            spec,
            photo_filename: photoFilename,
            pitch_deg: cameraPose.pitch_deg,
          }),
        });
        if (!r.ok) throw new Error(`mesh ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        setMesh({ url: data.url, specHash: data.spec_hash });
      } catch (err) {
        if (cancelled) return;
        console.error("[BuildingMesh] generation failed:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, photoFilename, cameraPose, spec]);

  const height = spec.stories * 3.5 + 5;

  if (loading && !mesh) {
    return (
      <Html center position={[0, height / 2, 0]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(0,0,0,0.75)",
            color: "white",
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          Generating 3D mesh… (30–90s)
        </div>
      </Html>
    );
  }

  if (error || !mesh) {
    return error ? (
      <Html center position={[0, height / 2, 0]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(200,40,40,0.85)",
            color: "white",
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          Mesh failed: {error}
        </div>
      </Html>
    ) : null;
  }

  return <LoadedMesh url={mesh.url} spec={spec} />;
}

/**
 * The mesh endpoint is JWT-gated, so we can't hand its URL straight to
 * `useGLTF` (which fires an unauthenticated fetch). Instead pull the GLB
 * through `apiBlobUrl` and feed the resulting blob: URL to drei.
 */
function LoadedMesh({ url, spec }: { url: string; spec: BuildingSpec }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    apiBlobUrl(url)
      .then((b) => {
        if (cancelled) {
          URL.revokeObjectURL(b);
          return;
        }
        created = b;
        setBlobUrl(b);
      })
      .catch((err) => console.error("[BuildingMesh] blob load failed:", err));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  if (!blobUrl) return null;
  return <TransformedMesh url={blobUrl} spec={spec} />;
}

/**
 * Trellis outputs a unit-scale mesh (~1m bounding box) centered at origin
 * with Y-up. We rescale it so the longest horizontal edge matches the spec's
 * footprint diagonal, then translate it so the base sits on y=0.
 */
function TransformedMesh({ url, spec }: { url: string; spec: BuildingSpec }) {
  const { scene } = useGLTF(url);

  const transformed = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Uniform scale preserves Trellis's aspect ratio. We pick the scale so
    // that whichever dimension is "most constrained" hits its spec target
    // without stretching the mesh: if the horizontal footprint hits first we
    // cap there, otherwise the stories-based height caps first.
    const targetHorizontal = Math.max(spec.footprint_width, spec.footprint_depth);
    const targetVertical = spec.stories * 3.5;
    const maxHorizontal = Math.max(size.x, size.z) || 1;
    const verticalSize = size.y || 1;
    const uniformScale = Math.min(
      targetHorizontal / maxHorizontal,
      targetVertical / verticalSize,
    );
    cloned.scale.setScalar(uniformScale);

    // Recenter: x/z at origin, base at y=0.
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    cloned.position.x -= center.x;
    cloned.position.z -= center.z;
    cloned.position.y -= scaledBox.min.y;

    return cloned;
  }, [scene, spec.footprint_width, spec.footprint_depth, spec.stories]);

  return <primitive object={transformed} />;
}
