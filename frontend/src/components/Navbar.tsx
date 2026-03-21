import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useProjectStore,
  WORKFLOW_STEPS,
  type WorkflowStep,
} from "../store/projectStore";

export default function Navbar() {
  const currentStep = useProjectStore((s) => s.currentStep);
  const completedSteps = useProjectStore((s) => s.completedSteps);
  const setStep = useProjectStore((s) => s.setStep);

  const setChatDrawerOpen = useProjectStore((s) => s.setChatDrawerOpen);
  const currentIdx = WORKFLOW_STEPS.findIndex((s) => s.key === currentStep);

  function canNavigate(step: WorkflowStep): boolean {
    const idx = WORKFLOW_STEPS.findIndex((s) => s.key === step);
    if (idx === 0) return true;
    const prev = WORKFLOW_STEPS[idx - 1];
    return prev ? completedSteps.has(prev.key) : false;
  }

  return (
    <nav className="flex h-[52px] shrink-0 items-center border-b border-border bg-card px-5">
      <div className="flex items-center gap-2.5 mr-8">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-purple-600 text-sm font-bold text-primary-foreground">
          I
        </div>
        <span className="text-[15px] font-semibold tracking-tight">
          Icarus
        </span>
      </div>

      <Separator orientation="vertical" className="h-6 mr-4" />

      <div className="flex items-center gap-0.5">
        {WORKFLOW_STEPS.map((step, i) => {
          const isActive = step.key === currentStep;
          const isCompleted = completedSteps.has(step.key);
          const navigable = canNavigate(step.key);

          return (
            <div key={step.key} className="flex items-center">
              {i > 0 && (
                <div
                  className={`h-px w-6 ${
                    i <= currentIdx ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <Tooltip>
                <TooltipTrigger
                  onClick={() => navigable && setStep(step.key)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                    isActive
                      ? "bg-primary/10 font-semibold text-primary"
                      : isCompleted
                        ? "text-green-400 hover:bg-muted/50"
                        : navigable
                          ? "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          : "text-muted-foreground/40 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] text-[10px] font-semibold ${
                      isActive
                        ? "border-primary text-primary"
                        : isCompleted
                          ? "border-green-400 bg-green-400 text-background"
                          : "border-muted-foreground/30"
                    }`}
                  >
                    {isCompleted ? "\u2713" : i + 1}
                  </span>
                  {step.label}
                </TooltipTrigger>
                {!navigable && !isActive && (
                  <TooltipContent side="bottom">
                    <p>Complete previous steps first</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            onClick={() => setChatDrawerOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Architect AI</p>
          </TooltipContent>
        </Tooltip>
        <Button variant="outline" size="sm" className="text-xs">
          New Project
        </Button>
      </div>
    </nav>
  );
}
