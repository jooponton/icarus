import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useProjectStore } from "../store/projectStore";
import UploadPanel from "./UploadPanel";
import ArchitectChat from "./ArchitectChat";
import SpecPreview from "./SpecPreview";

export default function Sidebar() {
  const currentStep = useProjectStore((s) => s.currentStep);
  const buildingSpec = useProjectStore((s) => s.buildingSpec);

  return (
    <aside className="flex w-[380px] flex-col border-r border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="p-5">
          {(currentStep === "upload" || currentStep === "reconstruct") && (
            <UploadPanel />
          )}

          {currentStep === "reconstruct" && (
            <>
              <Separator className="my-5" />
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Scene Reconstruction</h2>
                <p className="text-xs text-muted-foreground">
                  Processing will extract camera poses and build a 3D scene from
                  your footage.
                </p>
                <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
                  <p className="text-xs text-muted-foreground">
                    Coming soon
                  </p>
                </div>
              </div>
            </>
          )}

          {currentStep === "design" && (
            <div className="flex h-full flex-col" style={{ minHeight: "calc(100vh - 180px)" }}>
              <ArchitectChat />
            </div>
          )}

          {currentStep === "place" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Place Building</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Click on the scene to place your building. Drag to reposition.
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

          {currentStep === "export" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Export</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Export your scene as a 3D model or rendered video.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
                <p className="text-xs text-muted-foreground">
                  Export coming soon
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {buildingSpec && currentStep !== "place" && (
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
