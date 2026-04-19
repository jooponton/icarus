import { useProjectStore, WORKFLOW_STEPS, type WorkflowStep } from "../store/projectStore";

const NEXT_STEP: Record<WorkflowStep, WorkflowStep | null> = {
  upload: "reconstruct",
  reconstruct: "design",
  design: "place",
  place: "export",
  export: null,
};

const PIPELINE_CAPTIONS: Record<WorkflowStep, string> = {
  upload:
    "Next: feature extraction → sparse cloud → mesh → CAD-ready surfaces",
  reconstruct: "Next: define building spec with the Architect AI",
  design: "Next: place and manipulate the building in the scene",
  place: "Next: export scene as a 3D model",
  export: "Pipeline complete",
};

export default function ViewportPipelineBar() {
  const currentStep = useProjectStore((s) => s.currentStep);
  const completeStep = useProjectStore((s) => s.completeStep);
  const setStep = useProjectStore((s) => s.setStep);
  const uploadedFiles = useProjectStore((s) => s.uploadedFiles);

  const next = NEXT_STEP[currentStep];
  const canContinue =
    next !== null &&
    (currentStep !== "upload" || uploadedFiles.length > 0);

  function handleContinue() {
    if (!next) return;
    // Upload → if only images, skip reconstruction straight to design.
    if (currentStep === "upload") {
      const hasOnlyImages =
        uploadedFiles.length > 0 &&
        uploadedFiles.every((f) => f.type.startsWith("image/"));
      completeStep("upload");
      if (hasOnlyImages) {
        completeStep("reconstruct");
        setStep("design");
        return;
      }
    } else {
      completeStep(currentStep);
    }
    setStep(next);
  }

  const currentIdx = WORKFLOW_STEPS.findIndex((s) => s.key === currentStep);
  const stepLabel = WORKFLOW_STEPS[currentIdx]?.label ?? "Pipeline";

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/30 text-muted-foreground">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <path d="M9 1v3" /><path d="M15 1v3" />
              <path d="M9 20v3" /><path d="M15 20v3" />
              <path d="M20 9h3" /><path d="M20 14h3" />
              <path d="M1 9h3" /><path d="M1 14h3" />
            </svg>
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight text-foreground">
              {stepLabel}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {PIPELINE_CAPTIONS[currentStep]}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Documentation
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary/80 px-4 text-sm font-semibold text-primary-foreground hover:from-primary/95 hover:to-primary/75 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
