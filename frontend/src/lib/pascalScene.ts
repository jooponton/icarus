import {
  BuildingNode,
  LevelNode,
  SiteNode,
  SlabNode,
  WallNode,
  RoofNode,
  type AnyNode,
  type AnyNodeId,
} from "@pascal-app/core";
import type { SceneGraph } from "@pascal-app/editor";
import type { BuildingSpec } from "../store/projectStore";

type MaterialPreset =
  | "white"
  | "brick"
  | "concrete"
  | "wood"
  | "glass"
  | "metal"
  | "plaster"
  | "tile";

function materialPreset(raw: string | undefined): MaterialPreset {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("brick")) return "brick";
  if (s.includes("concrete")) return "concrete";
  if (s.includes("wood") || s.includes("timber") || s.includes("cedar")) return "wood";
  if (s.includes("glass")) return "glass";
  if (s.includes("metal") || s.includes("steel") || s.includes("aluminum")) return "metal";
  if (s.includes("stucco") || s.includes("plaster")) return "plaster";
  if (s.includes("tile")) return "tile";
  return "white";
}

function rectFootprint(width: number, depth: number): Array<[number, number]> {
  const w = width / 2;
  const d = depth / 2;
  return [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d],
  ];
}

function lShapedFootprint(
  width: number,
  depth: number,
  wingWidth: number,
  wingDepth: number,
): Array<[number, number]> {
  const w = width / 2;
  const d = depth / 2;
  const ww = wingWidth;
  const wd = wingDepth;
  return [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w + ww, d],
    [-w + ww, d + wd],
    [-w, d + wd],
  ];
}

function footprintForSpec(spec: BuildingSpec): Array<[number, number]> {
  if (spec.footprint_shape === "l-shaped") {
    return lShapedFootprint(
      spec.footprint_width,
      spec.footprint_depth,
      spec.wing_width ?? spec.footprint_width * 0.4,
      spec.wing_depth ?? spec.footprint_depth * 0.4,
    );
  }
  return rectFootprint(spec.footprint_width, spec.footprint_depth);
}

export function buildingSpecToSceneGraph(spec: BuildingSpec): SceneGraph {
  const preset = materialPreset(spec.material);
  const footprint = footprintForSpec(spec);
  const stories = Math.max(1, Math.floor(spec.stories));
  const wallHeight = 3;

  const nodes: Record<string, AnyNode> = {};

  const levelIds: Array<AnyNodeId> = [];

  for (let i = 0; i < stories; i++) {
    const levelChildrenIds: string[] = [];

    const slab = SlabNode.parse({
      polygon: footprint,
      material: { preset },
      elevation: 0.1,
    });
    nodes[slab.id] = slab;
    levelChildrenIds.push(slab.id);

    for (let k = 0; k < footprint.length; k++) {
      const a = footprint[k]!;
      const b = footprint[(k + 1) % footprint.length]!;
      const wall = WallNode.parse({
        start: a,
        end: b,
        height: wallHeight,
        thickness: 0.2,
        material: { preset },
      });
      nodes[wall.id] = wall;
      levelChildrenIds.push(wall.id);
    }

    if (i === stories - 1) {
      try {
        const roof = RoofNode.parse({
          polygon: footprint,
          material: { preset: "metal" as const },
        } as never);
        nodes[roof.id] = roof;
        levelChildrenIds.push(roof.id);
      } catch {
        // Roof schema may require more fields — skip if it fails
      }
    }

    const level = LevelNode.parse({
      level: i,
      children: levelChildrenIds,
    });

    for (const childId of levelChildrenIds) {
      const child = nodes[childId]!;
      (child as unknown as { parentId: string }).parentId = level.id;
    }

    nodes[level.id] = level;
    levelIds.push(level.id);
  }

  const building = BuildingNode.parse({
    children: levelIds,
  });
  for (const levelId of levelIds) {
    const level = nodes[levelId]!;
    (level as unknown as { parentId: string }).parentId = building.id;
  }
  nodes[building.id] = building;

  const site = SiteNode.parse({
    children: [building],
  });
  // Remove inline building (Pascal expects flat dict)
  (site as unknown as { children: string[] }).children = [building.id];
  (building as unknown as { parentId: string }).parentId = site.id;
  nodes[site.id] = site;

  return {
    nodes,
    rootNodeIds: [site.id],
  };
}
