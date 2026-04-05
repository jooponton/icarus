import type { BuildingSpec } from "../store/projectStore";
import ProceduralBuilding from "./ProceduralBuilding";

interface Props {
  spec: BuildingSpec;
  wireframe?: boolean;
  detailLevel?: number;
  textureUrls?: Record<string, string> | null;
}

/**
 * Renders a building that may have a compound footprint (e.g. L-shaped).
 * For rectangular specs, delegates directly to ProceduralBuilding.
 * For L-shaped specs, composes two ProceduralBuilding instances.
 */
export default function CompoundBuilding({
  spec,
  wireframe = false,
  detailLevel = 75,
  textureUrls = null,
}: Props) {
  if (spec.footprint_shape !== "l-shaped" || !spec.wing_width || !spec.wing_depth) {
    return (
      <ProceduralBuilding
        spec={spec}
        wireframe={wireframe}
        detailLevel={detailLevel}
        textureUrls={textureUrls}
      />
    );
  }

  // L-shape: main body + wing
  // Main body occupies full width but reduced depth (depth - wing_depth)
  const mainDepth = spec.footprint_depth - spec.wing_depth;
  const mainSpec: BuildingSpec = {
    ...spec,
    footprint_shape: "rectangular",
    footprint_depth: mainDepth,
  };

  // Wing extends from one corner
  const wingSpec: BuildingSpec = {
    ...spec,
    footprint_shape: "rectangular",
    footprint_width: spec.wing_width,
    footprint_depth: spec.wing_depth,
  };

  // Position wing at the back-right corner of the main body
  const wingX = (spec.footprint_width - spec.wing_width) / 2;
  const wingZ = -(mainDepth / 2 + spec.wing_depth / 2);

  return (
    <group>
      {/* Main body — centered */}
      <group position={[0, 0, spec.wing_depth / 2]}>
        <ProceduralBuilding
          spec={mainSpec}
          wireframe={wireframe}
          detailLevel={detailLevel}
          textureUrls={textureUrls}
        />
      </group>

      {/* Wing — offset to back-right */}
      <group position={[wingX, 0, wingZ + spec.wing_depth / 2]}>
        <ProceduralBuilding
          spec={wingSpec}
          wireframe={wireframe}
          detailLevel={detailLevel}
          textureUrls={textureUrls}
        />
      </group>
    </group>
  );
}
