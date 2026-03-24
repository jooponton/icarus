import { describe, it, expect } from "vitest";
import { getStyleConfig, getDetailLevelMultiplier } from "../lib/buildingStyles";

describe("getStyleConfig", () => {
  it("returns modern defaults for unknown style", () => {
    const config = getStyleConfig("nonexistent", "residential");
    expect(config.windowWidth).toBe(1.6);
    expect(config.hasCornices).toBe(false);
  });

  it("applies traditional preset with cornices", () => {
    const config = getStyleConfig("traditional", "residential");
    expect(config.hasCornices).toBe(true);
    expect(config.corniceHeight).toBeGreaterThan(0);
    expect(config.corniceDepth).toBeGreaterThan(0);
  });

  it("commercial override forces double door and wider glass ratio", () => {
    const config = getStyleConfig("modern", "commercial");
    expect(config.doubleDoor).toBe(true);
    expect(config.doorWidth).toBeGreaterThanOrEqual(1.8);
    expect(config.glassRatio).toBeGreaterThanOrEqual(0.3);
  });

  it("institutional override adds pilasters even for modern style", () => {
    const config = getStyleConfig("modern", "institutional");
    expect(config.hasPilasters).toBe(true);
    expect(config.pilasterWidth).toBeGreaterThan(0);
  });

  it("residential caps door width at 1.4", () => {
    const config = getStyleConfig("art deco", "residential");
    expect(config.doorWidth).toBeLessThanOrEqual(1.4);
  });
});

describe("getDetailLevelMultiplier", () => {
  it("returns 0.3 at detail level 0", () => {
    expect(getDetailLevelMultiplier(0)).toBeCloseTo(0.3);
  });

  it("returns 1.0 at detail level 50", () => {
    expect(getDetailLevelMultiplier(50)).toBeCloseTo(1.0);
  });

  it("returns 1.5 at detail level 100", () => {
    expect(getDetailLevelMultiplier(100)).toBeCloseTo(1.5);
  });

  it("clamps values below 0", () => {
    expect(getDetailLevelMultiplier(-10)).toBeCloseTo(0.3);
  });

  it("clamps values above 100", () => {
    expect(getDetailLevelMultiplier(150)).toBeCloseTo(1.5);
  });
});
