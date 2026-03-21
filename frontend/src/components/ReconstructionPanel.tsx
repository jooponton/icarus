import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useProjectStore, type PipelineStage } from "../store/projectStore";
import StatusBadge from "./StatusBadge";

const stageIcons: Record<string, React.ReactNode> = {
  feature: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  ),
  sparse: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="1" /><circle cx="6" cy="6" r="1" /><circle cx="18" cy="6" r="1" /><circle cx="6" cy="18" r="1" /><circle cx="18" cy="18" r="1" /><circle cx="3" cy="12" r="1" /><circle cx="21" cy="12" r="1" />
    </svg>
  ),
  dense: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
};

function StageCard({ stage }: { stage: PipelineStage }) {
  const statusVariant =
    stage.status === "completed"
      ? "ready"
      : stage.status === "running"
        ? "running"
        : stage.status === "error"
          ? "error"
          : "pending";

  const statusLabel =
    stage.status === "completed"
      ? "Complete"
      : stage.status === "running"
        ? "Running"
        : stage.status === "error"
          ? "Error"
          : "Pending";

  return (
    <Card className="bg-muted/20 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${
            stage.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
            stage.status === "running" ? "bg-primary/15 text-primary" :
            "bg-muted/50 text-muted-foreground/60"
          }`}>
            {stageIcons[stage.id] ?? stageIcons.feature}
          </div>
          <div>
            <span className="text-[12px] font-medium block">{stage.name}</span>
            {Object.entries(stage.stats).length > 0 && (
              <div className="flex gap-2.5 text-[10px] text-muted-foreground mt-0.5">
                {Object.entries(stage.stats).map(([k, v]) => (
                  <span key={k}>
                    {k}: <span className="text-foreground/60">{v}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <StatusBadge variant={statusVariant}>{statusLabel}</StatusBadge>
      </div>

      <div className="space-y-1">
        <Progress value={stage.progress} />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="tabular-nums">{stage.progress}%</span>
          {stage.status === "running" && (
            <span className="text-primary/70">Processing...</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ReconstructionPanel() {
  const pipelineStages = useProjectStore((s) => s.pipelineStages);
  const paused = useProjectStore((s) => s.reconstructionPaused);
  const setPaused = useProjectStore((s) => s.setReconstructionPaused);
  const completeStep = useProjectStore((s) => s.completeStep);
  const setStep = useProjectStore((s) => s.setStep);
  const updateStage = useProjectStore((s) => s.updatePipelineStage);

  const allComplete = pipelineStages.every((s) => s.status === "completed");
  const anyRunning = pipelineStages.some((s) => s.status === "running");

  function handleStartPipeline() {
    // Simulate pipeline start
    updateStage("feature", {
      status: "running",
      progress: 45,
      stats: { points: "00421k", runtime: "0:57" },
    });
    updateStage("sparse", {
      status: "pending",
      progress: 0,
      stats: { points: "—", reprojection: "—" },
    });
    updateStage("dense", {
      status: "pending",
      progress: 0,
      stats: {},
    });
  }

  function handleSimulateComplete() {
    updateStage("feature", {
      status: "completed",
      progress: 100,
      stats: { points: "1.2M", runtime: "3:42" },
    });
    updateStage("sparse", {
      status: "completed",
      progress: 100,
      stats: { points: "842k", reprojection: "0.3px" },
    });
    updateStage("dense", {
      status: "completed",
      progress: 100,
      stats: { faces: "2.1M", runtime: "8:15" },
    });
  }

  function handleContinue() {
    completeStep("reconstruct");
    setStep("design");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Reconstruction Pipeline</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Setting: Default
          </p>
        </div>
        <div className="flex gap-1.5">
          {anyRunning && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => setPaused(!paused)}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Pipeline stages */}
      <div className="space-y-2.5">
        {pipelineStages.map((stage) => (
          <StageCard key={stage.id} stage={stage} />
        ))}
      </div>

      {/* Actions */}
      {!anyRunning && !allComplete && (
        <Button onClick={handleStartPipeline} className="w-full">
          Start pipeline
        </Button>
      )}

      {anyRunning && (
        <Button
          variant="outline"
          onClick={handleSimulateComplete}
          className="w-full text-xs"
        >
          Simulate completion
        </Button>
      )}

      {allComplete && (
        <Button onClick={handleContinue} className="w-full">
          Continue to Design
        </Button>
      )}
    </div>
  );
}
