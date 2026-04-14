import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "../store/projectStore";
import { useTextureGeneration } from "../hooks/useTextureGeneration";
import StatusBadge from "./StatusBadge";

export default function DesignPanel() {
  const completeStep = useProjectStore((s) => s.completeStep);
  const setStep = useProjectStore((s) => s.setStep);
  const buildingSpec = useProjectStore((s) => s.buildingSpec);
  const validationResult = useProjectStore((s) => s.validationResult);
  const setValidationResult = useProjectStore((s) => s.setValidationResult);
  const textureStatus = useProjectStore((s) => s.textureStatus);
  const setChatDrawerOpen = useProjectStore((s) => s.setChatDrawerOpen);

  useTextureGeneration();

  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);
  useEffect(() => {
    if (!buildingSpec) {
      setValidationResult(null);
      return;
    }
    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/generate/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildingSpec),
          signal: controller.signal,
        });
        if (res.ok) setValidationResult(await res.json());
        else setValidationResult(null);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setValidationResult(null);
      }
    }, 300);
    return () => {
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [buildingSpec, setValidationResult]);

  function handleContinue() {
    completeStep("design");
    setStep("place");
  }

  const hasErrors = validationResult && !validationResult.valid;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Design</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {buildingSpec
              ? "Shape the building in the editor. Walls, slabs, items, roofs."
              : "Start by describing your building to the AI architect."}
          </p>
        </div>
        <StatusBadge variant="editing">Editing</StatusBadge>
      </div>

      {!buildingSpec && (
        <>
          <Card className="bg-primary/5 border-primary/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[12px] font-medium text-foreground">Describe your building</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tell the AI architect what you want to build — style, size, materials, number of stories. It will seed the 3D editor with a starting building.
            </p>
            <Button onClick={() => setChatDrawerOpen(true)} className="w-full">
              Open Architect AI
            </Button>
          </Card>
        </>
      )}

      {buildingSpec && (
        <>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Editor
            </span>
            <Card className="bg-muted/20 p-3 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stories</span>
                <span className="tabular-nums">{buildingSpec.stories}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Footprint</span>
                <span className="tabular-nums">{buildingSpec.footprint_width}×{buildingSpec.footprint_depth}m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Material</span>
                <span>{buildingSpec.material}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Roof</span>
                <span>{buildingSpec.roof_style}</span>
              </div>
            </Card>
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              Use the Pascal editor on the right to draw walls, add items, and refine the design. Undo/redo, measurements, and the full item catalog are all available.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Structural validation
            </span>

            {validationResult ? (
              <>
                <Card className="bg-muted/20 p-3 space-y-2">
                  <QualityRow label="Structural plausibility" value={`${validationResult.scores.structural_plausibility ?? 0}%`} good={(validationResult.scores.structural_plausibility ?? 0) >= 70} />
                  <QualityRow label="Proportion score" value={`${validationResult.scores.proportion_score ?? 0}%`} good={(validationResult.scores.proportion_score ?? 0) >= 70} />
                  <QualityRow label="Material compatibility" value={`${validationResult.scores.material_compatibility ?? 0}%`} good={(validationResult.scores.material_compatibility ?? 0) >= 70} />
                </Card>

                {validationResult.errors.length > 0 && (
                  <div className="space-y-1.5">
                    {validationResult.errors.map((e) => (
                      <div key={e.code} className="flex items-start gap-2 text-[11px]">
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">Error</Badge>
                        <span className="text-destructive">{e.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    {validationResult.warnings.map((w) => (
                      <div key={w.code} className="flex items-start gap-2 text-[11px]">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 border-yellow-500 text-yellow-500">Warn</Badge>
                        <span className="text-yellow-500">{w.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Card className="bg-muted/20 p-3 space-y-2">
                <QualityRow label="Structural plausibility" value="--" good />
                <QualityRow label="Proportion score" value="--" good />
                <QualityRow label="Material compatibility" value="--" good />
              </Card>
            )}
          </div>

          {textureStatus === "generating" && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Generating textures...
            </div>
          )}
          {textureStatus === "ready" && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-400">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              Textures applied
            </div>
          )}
          {textureStatus === "error" && (
            <div className="flex items-center gap-2 text-[11px] text-destructive">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              Texture generation failed
            </div>
          )}

          <Button onClick={handleContinue} className="w-full" disabled={!!hasErrors}>
            {hasErrors ? "Fix errors to continue" : "Continue to Place"}
          </Button>
        </>
      )}
    </div>
  );
}

function QualityRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={good ? "text-emerald-400" : "text-destructive"}>{value}</span>
    </div>
  );
}
