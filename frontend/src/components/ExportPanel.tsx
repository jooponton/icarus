import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useProjectStore, type ExportFormat } from "../store/projectStore";
import { exportGLTF, exportOBJ, exportSTL } from "../lib/exportScene";
import StatusBadge from "./StatusBadge";

const FORMAT_PRESETS: {
  key: ExportFormat;
  label: string;
  description: string;
}[] = [
  {
    key: "gltf",
    label: "glTF Binary (.glb)",
    description: "Universal 3D format with materials — Revit, Blender, web",
  },
  {
    key: "obj",
    label: "OBJ Wavefront (.obj)",
    description: "Widely supported mesh format — AutoCAD, SketchUp, 3ds Max",
  },
  {
    key: "stl",
    label: "STL Mesh (.stl)",
    description: "Solid geometry for 3D printing and CAD exchange",
  },
];

export default function ExportPanel() {
  const exportFormat = useProjectStore((s) => s.exportFormat);
  const setExportFormat = useProjectStore((s) => s.setExportFormat);
  const exportBundle = useProjectStore((s) => s.exportBundle);
  const setExportBundle = useProjectStore((s) => s.setExportBundle);
  const sceneGroup = useProjectStore((s) => s.sceneGroup);
  const projectName = useProjectStore((s) => s.projectName);
  const buildingSpec = useProjectStore((s) => s.buildingSpec);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!sceneGroup) return;
    setExporting(true);
    const name = projectName.replace(/\s+/g, "_").toLowerCase() || "icarus_export";
    try {
      if (exportFormat === "gltf") {
        await exportGLTF(sceneGroup, name);
      } else if (exportFormat === "obj") {
        exportOBJ(sceneGroup, name);
      } else {
        exportSTL(sceneGroup, name);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Export</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure format, quality, and delivery. Export will generate
            downloadable files.
          </p>
        </div>
        <StatusBadge variant="ready">Ready</StatusBadge>
      </div>

      <Separator />

      {/* Format presets */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Format Presets
        </span>

        <RadioGroup
          value={exportFormat}
          onValueChange={(v) => setExportFormat(v as ExportFormat)}
          className="space-y-1.5"
        >
          {FORMAT_PRESETS.map((preset) => (
            <label
              key={preset.key}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                exportFormat === preset.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <RadioGroupItem value={preset.key} className="mt-0.5" />
              <div>
                <div className="text-[12px] font-medium">{preset.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {preset.description}
                </div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      {/* Export bundle */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Export Bundle
        </span>

        <div className="space-y-2">
          <BundleOption
            label="OBJ surfaces"
            description="Wavefront .obj mesh"
            checked={exportBundle.obj}
            onCheckedChange={(v) => setExportBundle({ obj: v })}
          />
          <BundleOption
            label="Point cloud"
            description=".ply point cloud data"
            checked={exportBundle.pointCloud}
            onCheckedChange={(v) => setExportBundle({ pointCloud: v })}
          />
          <BundleOption
            label="Textured mesh"
            description="Mesh with UV-mapped textures"
            checked={exportBundle.texturedMesh}
            onCheckedChange={(v) => setExportBundle({ texturedMesh: v })}
          />
        </div>
      </div>

      <Separator />

      {/* Export preview stats */}
      <Card className="bg-muted/20 p-3 space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Building summary
        </span>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[14px] font-semibold tabular-nums">
              {buildingSpec?.stories ?? "—"}
            </div>
            <div className="text-[9px] text-muted-foreground">Stories</div>
          </div>
          <div>
            <div className="text-[14px] font-semibold tabular-nums">
              {buildingSpec ? `${buildingSpec.footprint_width}×${buildingSpec.footprint_depth}` : "—"}
            </div>
            <div className="text-[9px] text-muted-foreground">Footprint (m)</div>
          </div>
          <div>
            <div className="text-[14px] font-semibold tabular-nums">
              {exportFormat === "gltf" ? "GLB" : exportFormat === "obj" ? "OBJ" : "STL"}
            </div>
            <div className="text-[9px] text-muted-foreground">Format</div>
          </div>
        </div>
      </Card>

      <Button
        className="w-full gap-2"
        onClick={handleExport}
        disabled={!sceneGroup || exporting}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {exporting ? "Exporting..." : "Download"}
      </Button>

      {!sceneGroup && (
        <p className="text-[10px] text-muted-foreground/60 text-center">
          No building in scene — complete the Place step first
        </p>
      )}
    </div>
  );
}

function BundleOption({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
      />
      <div>
        <div className="text-[12px] font-medium group-hover:text-foreground transition-colors">
          {label}
        </div>
        <div className="text-[10px] text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}
