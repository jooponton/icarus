import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ToolButton {
  icon: string;
  label: string;
}

const tools: ToolButton[] = [
  { icon: "M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6z", label: "Select" },
  { icon: "M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zM16.2 13h2.8v6h-2.8z", label: "Move" },
  { icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z", label: "Rotate" },
] as const;

export default function ViewportToolbar() {
  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/80 px-1.5 py-1 backdrop-blur-md">
      {tools.map((tool) => (
        <Tooltip key={tool.label}>
          <TooltipTrigger
            disabled
            className="inline-flex h-7 w-7 items-center justify-center rounded-md p-0 text-muted-foreground/40 cursor-default"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d={tool.icon} />
            </svg>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{tool.label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      <Separator orientation="vertical" className="mx-0.5 h-4" />
      <Tooltip>
        <TooltipTrigger
          disabled
          className="inline-flex h-7 items-center justify-center rounded-md px-2 text-xs text-muted-foreground/40 cursor-default"
        >
          Reset View
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Reset camera to default position</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
