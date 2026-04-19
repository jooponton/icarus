import { useEffect } from "react";
import { apiFetch } from "../lib/api";
import { useProjectStore } from "../store/projectStore";

/**
 * Watches `backgroundImageUrl` and calls the backend ML pose estimator
 * (Depth Anything V2 metric + RANSAC ground-plane fit) whenever it changes.
 * The returned pose anchors the three.js camera + generated building to the
 * uploaded photo.
 */
export function useCameraPose() {
  const backgroundImageUrl = useProjectStore((s) => s.backgroundImageUrl);
  const projectId = useProjectStore((s) => s.projectId);
  const setCameraPose = useProjectStore((s) => s.setCameraPose);
  const setCameraPoseLoading = useProjectStore((s) => s.setCameraPoseLoading);

  useEffect(() => {
    if (!backgroundImageUrl || !projectId) {
      setCameraPose(null);
      return;
    }

    // Extract filename from the /api/uploads/<project>/<filename> URL.
    const filename = backgroundImageUrl.split("/").pop();
    if (!filename) return;

    let cancelled = false;
    setCameraPoseLoading(true);

    apiFetch("/api/pose/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, filename }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`pose estimate failed: ${res.status}`);
        return res.json();
      })
      .then((pose) => {
        if (cancelled) return;
        setCameraPose(pose);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[useCameraPose]", err);
        setCameraPose(null);
      })
      .finally(() => {
        if (cancelled) return;
        setCameraPoseLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [backgroundImageUrl, projectId, setCameraPose, setCameraPoseLoading]);
}
