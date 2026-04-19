import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useProjectStore } from "../store/projectStore";
import UploadPanel from "./UploadPanel";
import ReconstructionPanel from "./ReconstructionPanel";
import DesignPanel from "./DesignPanel";
import PlacePanel from "./PlacePanel";
import ExportPanel from "./ExportPanel";
import SpecPreview from "./SpecPreview";

export default function Sidebar() {
  const currentStep = useProjectStore((s) => s.currentStep);
  const buildingSpec = useProjectStore((s) => s.buildingSpec);

  return (
    <aside className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-5">
          {currentStep === "upload" && <UploadPanel />}

          {currentStep === "reconstruct" && <ReconstructionPanel />}

          {currentStep === "design" && <DesignPanel />}

          {currentStep === "place" && <PlacePanel />}

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
