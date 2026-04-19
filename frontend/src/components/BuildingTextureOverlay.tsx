import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useProjectStore } from "../store/projectStore";
import AtriaMark from "./AtriaMark";

const STAGES = [
  "Mixing pigments",
  "Laying down albedo",
  "Pulling normals from the grain",
  "Setting roughness response",
  "Baking ambient occlusion",
  "Aligning tiles to walls",
];

const PARTS: { id: string; label: string }[] = [
  { id: "wall", label: "Walls" },
  { id: "roof", label: "Roof" },
  { id: "door", label: "Door" },
  { id: "trim", label: "Trim" },
];

interface PartStage {
  id: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number;
}

/**
 * Brand loading moment — amber-on-obsidian card with the Atria wordmark,
 * rotating prose, and per-surface progress. Rendered outside the R3F Canvas.
 */
export default function BuildingTextureOverlay() {
  const textureStatus = useProjectStore((s) => s.textureStatus);
  const projectId = useProjectStore((s) => s.projectId);
  const currentStep = useProjectStore((s) => s.currentStep);

  const [stageIdx, setStageIdx] = useState(0);
  const [stages, setStages] = useState<PartStage[]>([]);

  const visible =
    textureStatus === "generating" &&
    !!projectId &&
    (currentStep === "design" || currentStep === "place" || currentStep === "export");

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setStageIdx((i) => (i + 1) % STAGES.length), 2400);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setStages([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await apiFetch(`/api/generate/textures/${projectId}/status`);
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setStages(data.stages ?? []);
      } catch {
        /* keep polling */
      }
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [visible, projectId]);

  if (!visible) return null;

  const completed = stages.filter((s) => s.status === "completed").length;
  const overallPct = Math.round((completed / PARTS.length) * 100);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
      {/* Ambient amber wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(245,158,11,0.18), transparent 60%)",
        }}
      />

      <div className="pointer-events-auto relative w-[440px] overflow-hidden rounded-2xl border border-[#f59e0b]/20 bg-[#0a0a0a]/95 shadow-[0_0_80px_-20px_rgba(245,158,11,0.5)] backdrop-blur-xl">
        {/* Top amber hairline */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#f59e0b] to-transparent" />

        <div className="px-8 pb-7 pt-7">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-md bg-[#f59e0b]/30" />
              <AtriaMark size={36} className="relative" />
            </div>
            <div className="flex-1">
              <div
                className="text-[22px] leading-none text-foreground"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Atria
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#f59e0b]/80">
                Painting materials
              </div>
            </div>
            <div className="text-xs tabular-nums text-muted-foreground">
              {overallPct}%
            </div>
          </div>

          <p className="mt-6 text-[20px] italic leading-tight text-foreground/90">
            {STAGES[stageIdx]}…
          </p>

          <div className="mt-5 h-[2px] overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>

          <ul className="mt-5 space-y-2">
            {PARTS.map((part) => {
              const s = stages.find((x) => x.id === part.id);
              const status = s?.status ?? "pending";
              return (
                <li
                  key={part.id}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span
                    className={
                      status === "completed" || status === "running"
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                    }
                  >
                    {part.label}
                  </span>
                  <span className="flex items-center gap-2">
                    {status === "running" && (
                      <span className="text-[11px] tabular-nums text-[#f59e0b]">
                        {s?.progress ?? 0}%
                      </span>
                    )}
                    {status === "completed" && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-[#f59e0b]"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {status === "running" && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f59e0b]" />
                    )}
                    {status === "pending" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    )}
                    {status === "error" && (
                      <span className="text-[11px] text-red-400">failed</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
