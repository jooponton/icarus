import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useProjectStore } from "../store/projectStore";
import SpecPreview from "./SpecPreview";

export default function PlacePanel() {
  const buildingSpec = useProjectStore((s) => s.buildingSpec);
  const placement = useProjectStore((s) => s.buildingPlacement);
  const transformMode = useProjectStore((s) => s.transformMode);
  const setTransformMode = useProjectStore((s) => s.setTransformMode);
  const setBuildingPlacement = useProjectStore((s) => s.setBuildingPlacement);
  const completeStep = useProjectStore((s) => s.completeStep);
  const setStep = useProjectStore((s) => s.setStep);

  function handleConfirm() {
    completeStep("place");
    setStep("export");
  }

  function handleReset() {
    setBuildingPlacement({ position: [0, 0, 0], rotation: [0, 0, 0] });
  }

  const pos = placement.position;
  const rot = placement.rotation;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Place Building</h2>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Use the gizmo in the viewport to position and rotate your building.
        </p>
      </div>

      {buildingSpec && <SpecPreview spec={buildingSpec} />}

      <Separator />

      {/* Transform mode */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Transform
        </span>
        <div className="flex gap-2">
          <Button
            variant={transformMode === "translate" ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs gap-1.5"
            onClick={() => setTransformMode("translate")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 9 2 12 5 15" />
              <polyline points="9 5 12 2 15 5" />
              <polyline points="15 19 12 22 9 19" />
              <polyline points="19 9 22 12 19 15" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            Move
          </Button>
          <Button
            variant={transformMode === "rotate" ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs gap-1.5"
            onClick={() => setTransformMode("rotate")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6" />
              <path d="M21.34 15.57a10 10 0 1 1-.57-8.38" />
            </svg>
            Rotate
          </Button>
        </div>
      </div>

      {/* Position readout */}
      <Card className="bg-muted/20 p-3 space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Position
        </span>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-muted-foreground/60">X</span>
            <div className="text-foreground/80 font-mono">{pos[0].toFixed(1)}m</div>
          </div>
          <div>
            <span className="text-muted-foreground/60">Y</span>
            <div className="text-foreground/80 font-mono">{pos[1].toFixed(1)}m</div>
          </div>
          <div>
            <span className="text-muted-foreground/60">Z</span>
            <div className="text-foreground/80 font-mono">{pos[2].toFixed(1)}m</div>
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Rotation
        </span>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-muted-foreground/60">X</span>
            <div className="text-foreground/80 font-mono">{((rot[0] * 180) / Math.PI).toFixed(0)}&deg;</div>
          </div>
          <div>
            <span className="text-muted-foreground/60">Y</span>
            <div className="text-foreground/80 font-mono">{((rot[1] * 180) / Math.PI).toFixed(0)}&deg;</div>
          </div>
          <div>
            <span className="text-muted-foreground/60">Z</span>
            <div className="text-foreground/80 font-mono">{((rot[2] * 180) / Math.PI).toFixed(0)}&deg;</div>
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleReset}>
          Reset
        </Button>
        <Button size="sm" className="flex-1 text-xs" onClick={handleConfirm}>
          Confirm placement
        </Button>
      </div>
    </div>
  );
}
