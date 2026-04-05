import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  createWindowGrid,
  createParapetGeometry,
  createStorefrontGeometry,
  createBalconyGeometry,
  createSetbackSections,
} from "../lib/buildingGeometry";
import { getStyleConfig } from "../lib/buildingStyles";

// Helper to get vertex count from a geometry
function vertexCount(geo: THREE.BufferGeometry): number {
  return geo.getAttribute("position").count;
}

describe("createWindowGrid", () => {
  const style = getStyleConfig("modern", "residential");

  it("creates windows for all stories", () => {
    const { glass } = createWindowGrid(10, 3, 3.2, style, 1.0, true);
    expect(vertexCount(glass)).toBeGreaterThan(0);
    glass.dispose();
  });

  it("skipGroundFloor produces fewer vertices", () => {
    const normal = createWindowGrid(10, 3, 3.2, style, 1.0, true, false);
    const skipped = createWindowGrid(10, 3, 3.2, style, 1.0, true, true);
    expect(vertexCount(skipped.glass)).toBeLessThan(vertexCount(normal.glass));
    normal.glass.dispose();
    skipped.glass.dispose();
  });

  it("1-story with skipGroundFloor returns empty-ish geometry", () => {
    const { glass } = createWindowGrid(10, 1, 3.2, style, 1.0, true, true);
    // With 1 story and skip ground floor, loop runs 0 iterations
    // mergeGeometries([]) returns a minimal geometry
    expect(vertexCount(glass)).toBeLessThanOrEqual(1);
    glass.dispose();
  });
});

describe("createParapetGeometry", () => {
  it("creates geometry with correct height placement", () => {
    const geo = createParapetGeometry(10, 8, 0.9, 0.2);
    expect(vertexCount(geo)).toBeGreaterThan(0);

    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      maxY = Math.max(maxY, pos.getY(i));
    }
    expect(maxY).toBeCloseTo(0.9, 1);
    geo.dispose();
  });

  it("works with small dimensions", () => {
    const geo = createParapetGeometry(3, 3, 0.5, 0.1);
    expect(vertexCount(geo)).toBeGreaterThan(0);
    geo.dispose();
  });
});

describe("createStorefrontGeometry", () => {
  it("creates glass and mullion geometry", () => {
    const { glass, mullions } = createStorefrontGeometry(12, 2.8, 3.2);
    expect(vertexCount(glass)).toBeGreaterThan(0);
    expect(vertexCount(mullions)).toBeGreaterThan(0);
    glass.dispose();
    mullions.dispose();
  });

  it("handles narrow face width", () => {
    const { glass, mullions } = createStorefrontGeometry(3, 2.8, 3.2);
    expect(vertexCount(glass)).toBeGreaterThan(0);
    glass.dispose();
    mullions.dispose();
  });
});

describe("createBalconyGeometry", () => {
  it("creates balconies for multi-story buildings", () => {
    const geo = createBalconyGeometry(10, 4, 3.2, 1.8, 1.2, 3.0);
    expect(vertexCount(geo)).toBeGreaterThan(0);
    geo.dispose();
  });

  it("returns empty geometry for 1-story buildings", () => {
    const geo = createBalconyGeometry(10, 1, 3.2, 1.8, 1.2, 3.0);
    // 1-story: no balconies, returns minimal geometry
    expect(vertexCount(geo)).toBeLessThanOrEqual(1);
    geo.dispose();
  });

  it("more stories means more vertices", () => {
    const small = createBalconyGeometry(10, 3, 3.2, 1.8, 1.2, 3.0);
    const large = createBalconyGeometry(10, 6, 3.2, 1.8, 1.2, 3.0);
    expect(vertexCount(large)).toBeGreaterThan(vertexCount(small));
    small.dispose();
    large.dispose();
  });
});

describe("createSetbackSections", () => {
  it("creates two sections with correct floor ranges", () => {
    const { sections, geometries } = createSetbackSections(12, 10, 3.2, 8, 4, 1.5);
    expect(sections).toHaveLength(2);
    expect(geometries).toHaveLength(2);

    // Lower section
    expect(sections[0]!.fromFloor).toBe(0);
    expect(sections[0]!.toFloor).toBe(4);
    expect(sections[0]!.width).toBe(12);
    expect(sections[0]!.depth).toBe(10);

    // Upper section — narrower
    expect(sections[1]!.fromFloor).toBe(4);
    expect(sections[1]!.toFloor).toBe(8);
    expect(sections[1]!.width).toBe(12 - 1.5 * 2);
    expect(sections[1]!.depth).toBe(10 - 1.5 * 2);

    for (const g of geometries) g.dispose();
  });

  it("clamps setback floor to valid range", () => {
    // setbackFloor 0 should clamp to 1
    const { sections } = createSetbackSections(10, 8, 3.2, 5, 0, 1.0);
    expect(sections[0]!.toFloor).toBe(1);

    // setbackFloor >= stories should clamp to stories-1
    const { sections: s2 } = createSetbackSections(10, 8, 3.2, 5, 10, 1.0);
    expect(s2[0]!.toFloor).toBe(4);
  });

  it("upper section is never smaller than 2m", () => {
    // Very large setback on a narrow building
    const { sections } = createSetbackSections(4, 4, 3.2, 5, 2, 5.0);
    expect(sections[1]!.width).toBeGreaterThanOrEqual(2);
    expect(sections[1]!.depth).toBeGreaterThanOrEqual(2);
  });
});
