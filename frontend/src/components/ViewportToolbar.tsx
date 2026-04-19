import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectStore, type ViewportMode } from "../store/projectStore";

const VIEWPORT_MODES: { value: ViewportMode; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "street", label: "Street view" },
  { value: "wireframe", label: "Wireframe" },
];

export default function ViewportToolbar() {
  const mode = useProjectStore((s) => s.viewportMode);
  const setMode = useProjectStore((s) => s.setViewportMode);
  const activeMode = VIEWPORT_MODES.find((m) => m.value === mode) ?? VIEWPORT_MODES[0]!;

  return (
    <div className="absolute left-3 right-3 top-3 z-20 flex items-center justify-between gap-3">
      {/* Left cluster — tools + reset */}
      <div className="flex items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l7.07 17 2.51-7.39L20 10.07 3 3z" />
            </svg>
            Orbit
          </button>
          <span className="h-10 w-px bg-border" aria-hidden="true" />
          <Tooltip>
            <TooltipTrigger
              disabled
              aria-label="Pan"
              className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9l-3 3 3 3" />
                <path d="M9 5l3-3 3 3" />
                <path d="M15 19l-3 3-3-3" />
                <path d="M19 9l3 3-3 3" />
                <path d="M2 12h20" />
                <path d="M12 2v20" />
              </svg>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Pan</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              disabled
              aria-label="Measure"
              className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.3 15.3l-6.6 6.6a1 1 0 0 1-1.4 0L2.1 10.7a1 1 0 0 1 0-1.4l6.6-6.6a1 1 0 0 1 1.4 0l11.2 11.2a1 1 0 0 1 0 1.4z" />
                <path d="M7 9l2 2" />
                <path d="M10 6l2 2" />
                <path d="M13 9l2 2" />
                <path d="M16 12l2 2" />
              </svg>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Measure</p></TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger
            disabled
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 text-sm font-semibold text-foreground backdrop-blur disabled:cursor-not-allowed disabled:opacity-80"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Reset view
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>Reset camera to default position</p></TooltipContent>
        </Tooltip>
      </div>

      {/* Right cluster — mode switcher + help */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="hidden md:inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 text-sm font-semibold text-foreground backdrop-blur hover:bg-card/80">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            {activeMode.label}
            <span className="text-xs text-muted-foreground">+ grid</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {VIEWPORT_MODES.map((m) => (
              <DropdownMenuItem key={m.value} onClick={() => setMode(m.value)}>
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            disabled
            aria-label="Help"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground backdrop-blur disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>Help</p></TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
