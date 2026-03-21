import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useProjectStore } from "../store/projectStore";
import StatusBadge from "./StatusBadge";

export default function DesignPanel() {
  const meshSmoothing = useProjectStore((s) => s.meshSmoothing);
  const meshDetailLevel = useProjectStore((s) => s.meshDetailLevel);
  const setMeshSmoothing = useProjectStore((s) => s.setMeshSmoothing);
  const setMeshDetailLevel = useProjectStore((s) => s.setMeshDetailLevel);
  const measurements = useProjectStore((s) => s.measurements);
  const addMeasurement = useProjectStore((s) => s.addMeasurement);
  const removeMeasurement = useProjectStore((s) => s.removeMeasurement);
  const completeStep = useProjectStore((s) => s.completeStep);
  const setStep = useProjectStore((s) => s.setStep);

  function handleAddMeasurement() {
    const id = `m-${Date.now()}`;
    const labels = ["A → B", "B → C", "C → D", "D → E", "E → F"];
    const label = labels[measurements.length % labels.length] ?? "A → B";
    const distance = `${(Math.random() * 20 + 2).toFixed(1)}m`;
    addMeasurement({ id, label, distance });
  }

  function handleContinue() {
    completeStep("design");
    setStep("place");
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Design Surface</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Refine mesh quality, measure geometry, and validate.
          </p>
        </div>
        <StatusBadge variant="editing">Editing</StatusBadge>
      </div>

      <Separator />

      {/* Mesh refinement */}
      <div className="space-y-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mesh refinement
        </span>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Smoothing</span>
              <span className="text-foreground/70 tabular-nums">{meshSmoothing}%</span>
            </div>
            <Slider
              value={[meshSmoothing]}
              onValueChange={(v) => setMeshSmoothing(Array.isArray(v) ? v[0] : v)}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Detail level</span>
              <span className="text-foreground/70 tabular-nums">{meshDetailLevel}%</span>
            </div>
            <Slider
              value={[meshDetailLevel]}
              onValueChange={(v) => setMeshDetailLevel(Array.isArray(v) ? v[0] : v)}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Measurements */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Measurements
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-primary"
            onClick={handleAddMeasurement}
          >
            + Add
          </Button>
        </div>

        {measurements.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 py-3 text-center">
            Click "Add" or measure in the viewport
          </p>
        ) : (
          <div className="space-y-1">
            {measurements.map((m) => (
              <Card key={m.id} className="bg-muted/20 px-3 py-2 flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-[11px] text-foreground/80">
                    Segment {m.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium tabular-nums text-foreground/70">
                    {m.distance}
                  </span>
                  <button
                    onClick={() => removeMeasurement(m.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Quality analysis */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quality analysis
        </span>
        <Card className="bg-muted/20 p-3 space-y-2">
          <QualityRow label="Mesh integrity" value="98.2%" good />
          <QualityRow label="Coverage" value="94.7%" good />
          <QualityRow label="Alignment error" value="0.3px" good />
          <QualityRow label="Noise ratio" value="1.2%" good />
        </Card>
      </div>

      <Button onClick={handleContinue} className="w-full">
        Continue to Place
      </Button>
    </div>
  );
}

function QualityRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={good ? "text-emerald-400" : "text-destructive"}>
        {value}
      </span>
    </div>
  );
}
