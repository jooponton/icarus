import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useProjectStore, type PipelineStage } from "../store/projectStore";
import StatusBadge from "./StatusBadge";

const stageIcons: Record<string, React.ReactNode> = {
  frames: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  ),
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
  convert: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
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
            stage.status === "error" ? "bg-destructive/15 text-destructive" :
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
          {stage.status === "error" && (
            <span className="text-destructive/70 truncate max-w-[200px]">
              {/* Show first part of error stats if available */}
              Failed
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ReconstructionPanel() {
  const pipelineStages = useProjectStore((s) => s.pipelineStages);
  const updateStage = useProjectStore((s) => s.updatePipelineStage);
  const projectId = useProjectStore((s) => s.projectId);
  const completeStep = useProjectStore((s) => s.completeStep);
  const setStep = useProjectStore((s) => s.setStep);
  const setSplatUrl = useProjectStore((s) => s.setSplatUrl);

  const [isPolling, setIsPolling] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allComplete = pipelineStages.every((s) => s.status === "completed");
  const anyRunning = pipelineStages.some((s) => s.status === "running");
  const anyError = pipelineStages.some((s) => s.status === "error");
  const notStarted = pipelineStages.every((s) => s.status === "pending");

  const pollStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/reconstruct/${projectId}/status`);
      if (!res.ok) return;
      const data = await res.json();

      for (const stage of data.stages) {
        updateStage(stage.id, {
          status: stage.status,
          progress: stage.progress,
          stats: stage.stats,
        });
      }

      if (data.splat_ready) {
        setSplatUrl(`/api/reconstruct/${projectId}/splat`);
      }

      // Stop polling when done
      const isDone = data.stages.every(
        (s: { status: string }) => s.status === "completed" || s.status === "error",
      );
      if (isDone) {
        setIsPolling(false);
      }
    } catch {
      // Silently retry on next interval
    }
  }, [projectId, updateStage, setSplatUrl]);

  // Polling effect
  useEffect(() => {
    if (!isPolling) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    pollingRef.current = setInterval(pollStatus, 2500);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isPolling, pollStatus]);

  async function handleStartPipeline() {
    if (!projectId) {
      setStartError("No project ID — upload files first");
      return;
    }
    setStartError(null);

    try {
      const res = await fetch(`/api/reconstruct/${projectId}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: "Unknown error" }));
        setStartError(data.detail || `Error ${res.status}`);
        return;
      }
      setIsPolling(true);
      // Immediately poll once
      await pollStatus();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start pipeline");
    }
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
          <h2 className="text-[17px] tracking-tight text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>Reconstruction</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            COLMAP + 3D Gaussian Splatting
          </p>
        </div>
      </div>

      <Separator />

      {/* Pipeline stages */}
      <div className="space-y-2.5">
        {pipelineStages.map((stage) => (
          <StageCard key={stage.id} stage={stage} />
        ))}
      </div>

      {/* Error message */}
      {startError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
          {startError}
        </div>
      )}

      {/* Actions */}
      {notStarted && !isPolling && (
        <Button onClick={handleStartPipeline} className="w-full">
          Start pipeline
        </Button>
      )}

      {anyError && !isPolling && (
        <Button onClick={handleStartPipeline} variant="outline" className="w-full">
          Retry pipeline
        </Button>
      )}

      {isPolling && (anyRunning || (!allComplete && !anyError)) && (
        <div className="text-center text-xs text-muted-foreground py-2">
          Pipeline running — this may take several minutes...
        </div>
      )}

      {allComplete && (
        <Button onClick={handleContinue} className="w-full">
          Continue to Design
        </Button>
      )}
    </div>
  );
}
