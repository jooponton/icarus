export interface StyleConfig {
  // Windows
  windowWidth: number;
  windowHeight: number;
  windowSpacingH: number;
  windowInset: number;
  windowFrameWidth: number;
  glassRatio: number;
  groundFloorWindowScale: number;

  // Cornices
  hasCornices: boolean;
  corniceHeight: number;
  corniceDepth: number;

  // Pilasters
  hasPilasters: boolean;
  pilasterWidth: number;
  pilasterDepth: number;

  // Door
  doorWidth: number;
  doorHeight: number;
  doubleDoor: boolean;
}

const STYLE_PRESETS: Record<string, StyleConfig> = {
  modern: {
    windowWidth: 1.6,
    windowHeight: 2.0,
    windowSpacingH: 2.4,
    windowInset: 0.02,
    windowFrameWidth: 0,
    glassRatio: 0.4,
    groundFloorWindowScale: 1.3,
    hasCornices: false,
    corniceHeight: 0,
    corniceDepth: 0,
    hasPilasters: false,
    pilasterWidth: 0,
    pilasterDepth: 0,
    doorWidth: 1.4,
    doorHeight: 2.6,
    doubleDoor: false,
  },
  traditional: {
    windowWidth: 1.0,
    windowHeight: 1.6,
    windowSpacingH: 2.2,
    windowInset: 0.08,
    windowFrameWidth: 0.06,
    glassRatio: 0.25,
    groundFloorWindowScale: 1.1,
    hasCornices: true,
    corniceHeight: 0.15,
    corniceDepth: 0.1,
    hasPilasters: false,
    pilasterWidth: 0,
    pilasterDepth: 0,
    doorWidth: 1.2,
    doorHeight: 2.5,
    doubleDoor: false,
  },
  industrial: {
    windowWidth: 2.0,
    windowHeight: 1.8,
    windowSpacingH: 3.0,
    windowInset: 0.04,
    windowFrameWidth: 0.04,
    glassRatio: 0.35,
    groundFloorWindowScale: 1.4,
    hasCornices: false,
    corniceHeight: 0,
    corniceDepth: 0,
    hasPilasters: false,
    pilasterWidth: 0,
    pilasterDepth: 0,
    doorWidth: 2.0,
    doorHeight: 3.0,
    doubleDoor: true,
  },
  minimalist: {
    windowWidth: 1.8,
    windowHeight: 2.2,
    windowSpacingH: 3.0,
    windowInset: 0.01,
    windowFrameWidth: 0,
    glassRatio: 0.3,
    groundFloorWindowScale: 1.2,
    hasCornices: false,
    corniceHeight: 0,
    corniceDepth: 0,
    hasPilasters: false,
    pilasterWidth: 0,
    pilasterDepth: 0,
    doorWidth: 1.2,
    doorHeight: 2.6,
    doubleDoor: false,
  },
  brutalist: {
    windowWidth: 0.8,
    windowHeight: 1.0,
    windowSpacingH: 2.0,
    windowInset: 0.2,
    windowFrameWidth: 0,
    glassRatio: 0.15,
    groundFloorWindowScale: 1.0,
    hasCornices: true,
    corniceHeight: 0.25,
    corniceDepth: 0.15,
    hasPilasters: true,
    pilasterWidth: 0.4,
    pilasterDepth: 0.2,
    doorWidth: 1.6,
    doorHeight: 2.8,
    doubleDoor: true,
  },
  colonial: {
    windowWidth: 0.9,
    windowHeight: 1.8,
    windowSpacingH: 2.0,
    windowInset: 0.06,
    windowFrameWidth: 0.07,
    glassRatio: 0.25,
    groundFloorWindowScale: 1.0,
    hasCornices: true,
    corniceHeight: 0.12,
    corniceDepth: 0.08,
    hasPilasters: true,
    pilasterWidth: 0.3,
    pilasterDepth: 0.1,
    doorWidth: 1.2,
    doorHeight: 2.5,
    doubleDoor: false,
  },
  "art deco": {
    windowWidth: 1.2,
    windowHeight: 2.0,
    windowSpacingH: 2.0,
    windowInset: 0.1,
    windowFrameWidth: 0.05,
    glassRatio: 0.3,
    groundFloorWindowScale: 1.5,
    hasCornices: true,
    corniceHeight: 0.2,
    corniceDepth: 0.12,
    hasPilasters: true,
    pilasterWidth: 0.35,
    pilasterDepth: 0.12,
    doorWidth: 1.6,
    doorHeight: 2.8,
    doubleDoor: true,
  },
  mediterranean: {
    windowWidth: 0.9,
    windowHeight: 1.4,
    windowSpacingH: 2.2,
    windowInset: 0.1,
    windowFrameWidth: 0.06,
    glassRatio: 0.2,
    groundFloorWindowScale: 1.2,
    hasCornices: true,
    corniceHeight: 0.12,
    corniceDepth: 0.08,
    hasPilasters: false,
    pilasterWidth: 0,
    pilasterDepth: 0,
    doorWidth: 1.3,
    doorHeight: 2.4,
    doubleDoor: false,
  },
  contemporary: {
    windowWidth: 1.5,
    windowHeight: 2.0,
    windowSpacingH: 2.4,
    windowInset: 0.03,
    windowFrameWidth: 0.02,
    glassRatio: 0.35,
    groundFloorWindowScale: 1.3,
    hasCornices: false,
    corniceHeight: 0,
    corniceDepth: 0,
    hasPilasters: false,
    pilasterWidth: 0,
    pilasterDepth: 0,
    doorWidth: 1.4,
    doorHeight: 2.6,
    doubleDoor: false,
  },
  organic: {
    windowWidth: 1.2,
    windowHeight: 1.4,
    windowSpacingH: 2.6,
    windowInset: 0.05,
    windowFrameWidth: 0.03,
    glassRatio: 0.25,
    groundFloorWindowScale: 1.1,
    hasCornices: false,
    corniceHeight: 0,
    corniceDepth: 0,
    hasPilasters: false,
    pilasterWidth: 0,
    pilasterDepth: 0,
    doorWidth: 1.3,
    doorHeight: 2.5,
    doubleDoor: false,
  },
};

const DEFAULT_STYLE = STYLE_PRESETS.modern;

/**
 * Get style config for a building, merging style preset with building-type overrides.
 */
export function getStyleConfig(style: string, buildingType: string): StyleConfig {
  const base: StyleConfig = Object.assign({}, DEFAULT_STYLE, STYLE_PRESETS[style.toLowerCase()]);
  const config: StyleConfig = { ...base };

  // Building-type overrides
  switch (buildingType.toLowerCase()) {
    case "commercial":
      config.groundFloorWindowScale = Math.max(config.groundFloorWindowScale, 1.6);
      config.doubleDoor = true;
      config.doorWidth = Math.max(config.doorWidth, 1.8);
      config.glassRatio = Math.max(config.glassRatio, 0.3);
      break;
    case "institutional":
      config.hasPilasters = true;
      config.pilasterWidth = config.pilasterWidth || 0.35;
      config.pilasterDepth = config.pilasterDepth || 0.12;
      config.doubleDoor = true;
      config.doorWidth = Math.max(config.doorWidth, 1.8);
      break;
    case "industrial":
      config.windowHeight = Math.max(config.windowHeight, 1.8);
      config.windowWidth = Math.max(config.windowWidth, 1.8);
      config.doorWidth = Math.max(config.doorWidth, 2.0);
      config.doorHeight = Math.max(config.doorHeight, 3.0);
      config.doubleDoor = true;
      break;
    case "residential":
      config.doorWidth = Math.min(config.doorWidth, 1.4);
      break;
  }

  return config;
}

/**
 * Map the 0-100 detail level slider to a multiplier for window density and ornamentation.
 * 0 → 0.3 (sparse), 50 → 1.0 (normal), 100 → 1.5 (dense)
 */
export function getDetailLevelMultiplier(detailLevel: number): number {
  const clamped = Math.max(0, Math.min(100, detailLevel));
  if (clamped <= 50) {
    return 0.3 + (clamped / 50) * 0.7; // 0.3 to 1.0
  }
  return 1.0 + ((clamped - 50) / 50) * 0.5; // 1.0 to 1.5
}
