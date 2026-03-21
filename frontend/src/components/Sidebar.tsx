import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useProjectStore } from "../store/projectStore";
import UploadPanel from "./UploadPanel";
import ReconstructionPanel from "./ReconstructionPanel";
import DesignPanel from "./DesignPanel";
import ExportPanel from "./ExportPanel";
import SpecPreview from "./SpecPreview";

export default function Sidebar() {
  const currentStep = useProjectStore((s) => s.currentStep);
  const buildingSpec = useProjectStore((s) => s.buildingSpec);

  return (
    <aside className="flex w-[380px] flex-col border-r border-border bg-card">
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-5">
          {currentStep === "upload" && <UploadPanel />}

          {currentStep === "reconstruct" && <ReconstructionPanel />}

          {currentStep === "design" && <DesignPanel />}

          {currentStep === "place" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Place Building</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Click on the scene to place your building. Drag to
                  reposition.
                </p>
              </div>
              {buildingSpec && <SpecPreview spec={buildingSpec} />}
              <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
                <p className="text-xs text-muted-foreground">
                  3D placement coming soon
                </p>
              </div>
            </div>
          )}

          {currentStep === "export" && <ExportPanel />}
        </div>
      </ScrollArea>

      {buildingSpec && currentStep !== "place" && currentStep !== "export" && (
        <>
          <Separator />
          <div className="p-4">
            <SpecPreview spec={buildingSpec} />
          </div>
        </>
      )}
    </aside>
  );
}
