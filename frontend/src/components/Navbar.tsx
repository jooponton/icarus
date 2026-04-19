import { Button } from "@/components/ui/button";
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
import AtriaMark from "./AtriaMark";

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
    <nav className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card/95 backdrop-blur px-4 lg:px-6">
      {/* Brand lockup */}
      <div className="flex shrink-0 items-center gap-3">
        <AtriaMark size={36} />
        <div className="leading-tight">
          <div
            className="text-[20px] tracking-tight text-foreground"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Atria
          </div>
          <div className="hidden sm:block text-[11px] text-muted-foreground">
            Survey workspace
          </div>
        </div>
      </div>

      {/* Stepper */}
      <ol className="flex flex-1 min-w-0 items-center justify-center gap-1 sm:gap-2">
        {WORKFLOW_STEPS.map((step, i) => {
          const isActive = step.key === currentStep;
          const isCompleted = completedSteps.has(step.key);
          const navigable = canNavigate(step.key);
          const isPast = i <= currentIdx;

          return (
            <li key={step.key} className="flex items-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`mx-0.5 sm:mx-1 h-px w-3 sm:w-6 lg:w-10 ${
                    isPast ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <Tooltip>
                <TooltipTrigger
                  onClick={() => navigable && setStep(step.key)}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                    isActive
                      ? "border border-primary/25 bg-primary/10 font-semibold text-primary"
                      : isCompleted
                        ? "text-green-400 hover:bg-muted/50"
                        : navigable
                          ? "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          : "cursor-not-allowed text-muted-foreground/40"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                      isActive
                        ? "border-primary/25 bg-primary/15 text-primary"
                        : isCompleted
                          ? "border-green-400 bg-green-400 text-background"
                          : "border-border bg-muted/40"
                    }`}
                  >
                    {isCompleted ? "\u2713" : i + 1}
                  </span>
                  <span className="hidden lg:inline">{step.label}</span>
                </TooltipTrigger>
                {!navigable && !isActive && (
                  <TooltipContent side="bottom">
                    <p>Complete previous steps first</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </li>
          );
        })}
      </ol>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
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

        <button
          type="button"
          disabled
          className="hidden md:inline-flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {/* TODO: wire alerts panel */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          Alerts
        </button>

        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" aria-label="New Project">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="hidden sm:inline">New Project</span>
        </Button>
      </div>
    </nav>
  );
}
