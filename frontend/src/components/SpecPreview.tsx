import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BuildingSpec } from "../store/projectStore";

interface Props {
  spec: BuildingSpec;
}

export default function SpecPreview({ spec }: Props) {
  const rows = [
    ["Type", spec.building_type],
    ["Stories", String(spec.stories)],
    ["Footprint", `${spec.footprint_width}m x ${spec.footprint_depth}m`],
    ["Roof", spec.roof_style],
    ["Material", spec.material],
    ["Style", spec.style],
  ];

  return (
    <Card className="bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Building Spec
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Final
        </Badge>
      </div>
      <div className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground/80 capitalize">{value}</span>
          </div>
        ))}
      </div>
      {spec.notes && (
        <p className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
          {spec.notes}
        </p>
      )}
    </Card>
  );
}
