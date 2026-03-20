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
    <div>
      <h3 style={{ fontSize: 13, color: "#4a90d9", margin: "0 0 8px" }}>
        Building Spec Finalized
      </h3>
      <table style={{ width: "100%", fontSize: 12 }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td style={{ color: "#888", padding: "2px 8px 2px 0" }}>
                {label}
              </td>
              <td style={{ color: "#ccc" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {spec.notes && (
        <p style={{ fontSize: 11, color: "#666", marginTop: 6 }}>
          {spec.notes}
        </p>
      )}
    </div>
  );
}
