import { useEffect } from "react";
import { useProjectStore } from "../store/projectStore";

const STORAGE_KEY = "icarus_project_id";

/**
 * Restore project state from localStorage + backend on page load.
 * Persists projectId to localStorage whenever it changes.
 */
export function useProjectRestore() {
  const projectId = useProjectStore((s) => s.projectId);
  const setProjectMeta = useProjectStore((s) => s.setProjectMeta);
  const setBuildingSpec = useProjectStore((s) => s.setBuildingSpec);
  const setStep = useProjectStore((s) => s.setStep);
  const completeStep = useProjectStore((s) => s.completeStep);
  const setSplatUrl = useProjectStore((s) => s.setSplatUrl);

  // On mount: restore projectId from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !projectId) {
      setProjectMeta({ projectId: saved });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When projectId is set, persist it and fetch project state
  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(STORAGE_KEY, projectId);

    let cancelled = false;

    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;

        if (data.name) {
          setProjectMeta({ projectName: data.name });
        }

        // Restore workflow step based on project state
        if (data.spec) {
          setBuildingSpec(data.spec);
          completeStep("upload");
          completeStep("reconstruct");
          setStep("design");
        }

        if (data.status === "splat_ready") {
          completeStep("upload");
          completeStep("reconstruct");
          setSplatUrl(`/api/reconstruct/${projectId}/splat`);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [projectId, setProjectMeta, setBuildingSpec, setStep, completeStep, setSplatUrl]);
}
