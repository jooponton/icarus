import { useEffect, useMemo } from "react";
import { Editor, applySceneGraphToEditor } from "@pascal-app/editor";
import { useProjectStore } from "../store/projectStore";
import { buildingSpecToSceneGraph } from "../lib/pascalScene";

export default function PascalDesignEditor() {
  const buildingSpec = useProjectStore((s) => s.buildingSpec);
  const projectId = useProjectStore((s) => s.projectId);

  const specKey = useMemo(
    () => (buildingSpec ? JSON.stringify(buildingSpec) : null),
    [buildingSpec],
  );

  useEffect(() => {
    if (!buildingSpec) return;
    const sceneGraph = buildingSpecToSceneGraph(buildingSpec);
    applySceneGraphToEditor(sceneGraph);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  return (
    <div className="absolute inset-0 z-10">
      <Editor
        layoutVersion="v2"
        projectId={projectId || "icarus-design"}
      />
    </div>
  );
}
