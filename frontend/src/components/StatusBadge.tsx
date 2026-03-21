import { Badge } from "@/components/ui/badge";

type StatusVariant = "ready" | "editing" | "uploaded" | "queued" | "running" | "error" | "pending";

const variantStyles: Record<StatusVariant, string> = {
  ready: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  editing: "bg-primary/15 text-primary border-primary/30",
  uploaded: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  running: "bg-primary/15 text-primary border-primary/30",
  queued: "bg-muted text-muted-foreground border-border",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  pending: "bg-muted text-muted-foreground border-border",
};

interface Props {
  variant: StatusVariant;
  children: React.ReactNode;
}

export default function StatusBadge({ variant, children }: Props) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 font-medium ${variantStyles[variant]}`}
    >
      {children}
    </Badge>
  );
}
