import * as THREE from "three";
import type { StyleConfig } from "./buildingStyles";

// ─── Window Grid ─────────────────────────────────────────────────────────────

/**
 * Create a grid of window planes for one face of the building.
 * Returns a merged BufferGeometry containing all window panes (recessed planes)
 * and optionally a second geometry for window frames.
 */
export function createWindowGrid(
  faceWidth: number,
  stories: number,
  storyHeight: number,
  style: StyleConfig,
  detailMultiplier: number,
  isGroundFloor: boolean,
  skipGroundFloor: boolean = false,
): { glass: THREE.BufferGeometry; frame: THREE.BufferGeometry | null } {
  const winW = style.windowWidth;
  const winH = style.windowHeight;
  const spacing = style.windowSpacingH / Math.max(detailMultiplier, 0.1);

  // How many windows fit across this face (with margin on edges)
  const margin = Math.min(1.0, faceWidth * 0.15);
  const usableWidth = Math.max(faceWidth * 0.2, faceWidth - margin * 2);
  const cols = Math.max(1, Math.floor(usableWidth / spacing));
  const actualSpacing = usableWidth / cols;

  const glassGeos: THREE.BufferGeometry[] = [];
  const frameGeos: THREE.BufferGeometry[] = [];

  const hasFrame = style.windowFrameWidth > 0;

  const startStory = skipGroundFloor ? 1 : 0;
  for (let story = startStory; story < stories; story++) {
    const floorY = story * storyHeight;
    const windowCenterY = floorY + storyHeight * 0.55; // slightly above mid-floor

    const scale = story === 0 && isGroundFloor ? style.groundFloorWindowScale : 1.0;
    const w = winW * scale;
    const h = winH * scale;

    for (let col = 0; col < cols; col++) {
      const windowCenterX = margin + actualSpacing * (col + 0.5) - faceWidth / 2;

      // Glass pane — a thin recessed plane
      const glassGeo = new THREE.PlaneGeometry(w, h);
      glassGeo.translate(windowCenterX, windowCenterY, 0);
      glassGeos.push(glassGeo);

      // Frame — slightly larger plane behind the glass
      if (hasFrame) {
        const fw = style.windowFrameWidth;
        const frameGeo = new THREE.PlaneGeometry(w + fw * 2, h + fw * 2);
        frameGeo.translate(windowCenterX, windowCenterY, -0.001);
        frameGeos.push(frameGeo);
      }
    }
  }

  const glass = mergeGeometries(glassGeos);
  const frame = hasFrame ? mergeGeometries(frameGeos) : null;

  // Dispose temp geometries
  for (const g of glassGeos) g.dispose();
  for (const g of frameGeos) g.dispose();

  return { glass, frame };
}

// ─── Door ────────────────────────────────────────────────────────────────────

/**
 * Create door geometry for the front face ground floor.
 */
export function createDoorGeometry(
  doorWidth: number,
  doorHeight: number,
  doubleDoor: boolean,
): { door: THREE.BufferGeometry; frame: THREE.BufferGeometry } {
  const w = doubleDoor ? doorWidth * 2 : doorWidth;
  const h = doorHeight;

  const doorGeo = new THREE.PlaneGeometry(w, h);
  doorGeo.translate(0, h / 2, 0);

  // Door frame
  const frameW = w + 0.12;
  const frameH = h + 0.08;
  const frameGeo = new THREE.PlaneGeometry(frameW, frameH);
  frameGeo.translate(0, h / 2 - 0.04, -0.001);

  return { door: doorGeo, frame: frameGeo };
}

// ─── Cornices ────────────────────────────────────────────────────────────────

/**
 * Create horizontal cornice/ledge geometry at each floor level.
 * Returns 4-face cornices (front, back, left, right) merged.
 */
export function createCorniceGeometry(
  width: number,
  depth: number,
  storyHeight: number,
  stories: number,
  corniceHeight: number,
  corniceDepth: number,
): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  for (let i = 1; i <= stories; i++) {
    const y = i * storyHeight;

    // Front cornice
    const front = new THREE.BoxGeometry(width + corniceDepth * 2, corniceHeight, corniceDepth);
    front.translate(0, y, depth / 2 + corniceDepth / 2);
    geos.push(front);

    // Back cornice
    const back = new THREE.BoxGeometry(width + corniceDepth * 2, corniceHeight, corniceDepth);
    back.translate(0, y, -(depth / 2 + corniceDepth / 2));
    geos.push(back);

    // Left cornice
    const left = new THREE.BoxGeometry(corniceDepth, corniceHeight, depth);
    left.translate(-(width / 2 + corniceDepth / 2), y, 0);
    geos.push(left);

    // Right cornice
    const right = new THREE.BoxGeometry(corniceDepth, corniceHeight, depth);
    right.translate(width / 2 + corniceDepth / 2, y, 0);
    geos.push(right);
  }

  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

// ─── Pilasters ───────────────────────────────────────────────────────────────

/**
 * Create vertical pilaster/column protrusions on the front and back faces.
 */
export function createPilasterGeometry(
  totalHeight: number,
  pilasterWidth: number,
  pilasterDepth: number,
  faceWidth: number,
  depth: number,
): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const spacing = Math.max(3.0, faceWidth / Math.max(2, Math.floor(faceWidth / 4)));
  const count = Math.max(2, Math.floor(faceWidth / spacing));

  for (let i = 0; i < count; i++) {
    const x = -faceWidth / 2 + i * spacing;

    // Front pilaster
    const front = new THREE.BoxGeometry(pilasterWidth, totalHeight, pilasterDepth);
    front.translate(x, totalHeight / 2, depth / 2 + pilasterDepth / 2);
    geos.push(front);

    // Back pilaster
    const back = new THREE.BoxGeometry(pilasterWidth, totalHeight, pilasterDepth);
    back.translate(x, totalHeight / 2, -(depth / 2 + pilasterDepth / 2));
    geos.push(back);
  }

  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

// ─── Roof Types ──────────────────────────────────────────────────────────────

/**
 * Create a mansard roof: steep lower slope on all 4 sides + flat/gentle top.
 */
export function createMansardRoof(
  width: number,
  depth: number,
): THREE.BufferGeometry {
  const overhang = 0.4;
  const w = width / 2 + overhang;
  const d = depth / 2 + overhang;
  const lowerH = 2.0; // height of steep section
  const inset = 1.5; // how far the top edge pulls in
  const upperH = 0.6; // height of flat top section

  // 8 corners: 4 bottom outer, 4 top inner
  const positions = new Float32Array([
    // Bottom outer ring (y=0)
    -w, 0, d,     // 0: front-left
    w, 0, d,      // 1: front-right
    w, 0, -d,     // 2: back-right
    -w, 0, -d,    // 3: back-left
    // Top inner ring (y=lowerH)
    -(w - inset), lowerH, (d - inset),   // 4
    (w - inset), lowerH, (d - inset),    // 5
    (w - inset), lowerH, -(d - inset),   // 6
    -(w - inset), lowerH, -(d - inset),  // 7
    // Flat top ring (y=lowerH+upperH)
    -(w - inset), lowerH + upperH, (d - inset),   // 8
    (w - inset), lowerH + upperH, (d - inset),    // 9
    (w - inset), lowerH + upperH, -(d - inset),   // 10
    -(w - inset), lowerH + upperH, -(d - inset),  // 11
  ]);

  const indices = [
    // Front slope
    0, 1, 5, 0, 5, 4,
    // Right slope
    1, 2, 6, 1, 6, 5,
    // Back slope
    2, 3, 7, 2, 7, 6,
    // Left slope
    3, 0, 4, 3, 4, 7,
    // Flat top
    8, 9, 10, 8, 10, 11,
    // Top sides (connect inner ring to flat top)
    4, 5, 9, 4, 9, 8,
    5, 6, 10, 5, 10, 9,
    6, 7, 11, 6, 11, 10,
    7, 4, 8, 7, 8, 11,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create a butterfly (inverted gable) roof: two planes angling down toward center.
 */
export function createButterflyRoof(
  width: number,
  depth: number,
): THREE.BufferGeometry {
  const overhang = 0.5;
  const w = width / 2 + overhang;
  const d = depth / 2 + overhang;
  const edgeH = 2.0; // height at outer edges
  const centerH = 0.5; // height at center valley

  const positions = new Float32Array([
    // Left edge top
    -w, edgeH, d,    // 0
    -w, edgeH, -d,   // 1
    // Center valley
    0, centerH, d,   // 2
    0, centerH, -d,  // 3
    // Right edge top
    w, edgeH, d,     // 4
    w, edgeH, -d,    // 5
    // Bottom edges (for fascia)
    -w, 0, d,        // 6
    -w, 0, -d,       // 7
    w, 0, d,         // 8
    w, 0, -d,        // 9
  ]);

  const indices = [
    // Left slope (top surface)
    0, 2, 3, 0, 3, 1,
    // Right slope (top surface)
    2, 4, 5, 2, 5, 3,
    // Left fascia (outer wall)
    6, 0, 1, 6, 1, 7,
    // Right fascia (outer wall)
    4, 8, 9, 4, 9, 5,
    // Front panel (left half)
    6, 8, 2, 6, 2, 0,
    // Front panel (right half)
    8, 4, 2,
    // Back panel (left half)
    7, 1, 3, 7, 3, 9,
    // Back panel (right half)
    9, 3, 5,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─── Parapets ───────────────────────────────────────────────────────────

/**
 * Create a parapet wall around the roof perimeter (4 thin boxes).
 */
export function createParapetGeometry(
  width: number,
  depth: number,
  parapetHeight: number,
  parapetThickness: number,
): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const halfH = parapetHeight / 2;
  const t = parapetThickness;

  // Front parapet
  const front = new THREE.BoxGeometry(width + t * 2, parapetHeight, t);
  front.translate(0, halfH, depth / 2 + t / 2);
  geos.push(front);

  // Back parapet
  const back = new THREE.BoxGeometry(width + t * 2, parapetHeight, t);
  back.translate(0, halfH, -(depth / 2 + t / 2));
  geos.push(back);

  // Left parapet
  const left = new THREE.BoxGeometry(t, parapetHeight, depth);
  left.translate(-(width / 2 + t / 2), halfH, 0);
  geos.push(left);

  // Right parapet
  const right = new THREE.BoxGeometry(t, parapetHeight, depth);
  right.translate(width / 2 + t / 2, halfH, 0);
  geos.push(right);

  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

// ─── Storefronts ────────────────────────────────────────────────────────

/**
 * Create a commercial storefront for the ground floor of one face.
 * Returns glass panels and thin vertical mullions.
 */
export function createStorefrontGeometry(
  faceWidth: number,
  storefrontHeight: number,
  storyHeight: number,
): { glass: THREE.BufferGeometry; mullions: THREE.BufferGeometry } {
  const margin = Math.min(0.8, faceWidth * 0.08);
  const usableWidth = faceWidth - margin * 2;
  const panelCount = Math.max(1, Math.floor(usableWidth / 2.0));
  const panelWidth = usableWidth / panelCount;
  const mullionWidth = 0.06;
  const height = Math.min(storefrontHeight, storyHeight * 0.85);
  const yCenter = height / 2 + 0.1; // slight gap from ground

  const glassGeos: THREE.BufferGeometry[] = [];
  const mullionGeos: THREE.BufferGeometry[] = [];

  for (let i = 0; i < panelCount; i++) {
    const x = margin + panelWidth * (i + 0.5) - faceWidth / 2;

    const glass = new THREE.PlaneGeometry(panelWidth - mullionWidth, height);
    glass.translate(x, yCenter, 0);
    glassGeos.push(glass);

    // Mullion to the right of each panel (skip last)
    if (i < panelCount - 1) {
      const mullion = new THREE.PlaneGeometry(mullionWidth, height);
      mullion.translate(x + panelWidth / 2, yCenter, 0.001);
      mullionGeos.push(mullion);
    }
  }

  // Frame around the whole storefront
  const frameH = 0.08;
  const topFrame = new THREE.PlaneGeometry(usableWidth, frameH);
  topFrame.translate(0, yCenter + height / 2 + frameH / 2, 0.001);
  mullionGeos.push(topFrame);

  const glass = mergeGeometries(glassGeos);
  const mullions = mergeGeometries(mullionGeos);
  for (const g of glassGeos) g.dispose();
  for (const g of mullionGeos) g.dispose();

  return { glass, mullions };
}

// ─── Balconies ──────────────────────────────────────────────────────────

/**
 * Create balcony geometry for one face of the building.
 * Each balcony: slab + railing (left, right, front).
 */
export function createBalconyGeometry(
  faceWidth: number,
  stories: number,
  storyHeight: number,
  balconyWidth: number,
  balconyDepth: number,
  balconySpacing: number,
): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  const margin = Math.min(1.5, faceWidth * 0.15);
  const usableWidth = Math.max(balconyWidth, faceWidth - margin * 2);
  const cols = Math.max(1, Math.floor(usableWidth / balconySpacing));
  const actualSpacing = usableWidth / cols;

  const slabThickness = 0.12;
  const railingHeight = 1.0;
  const railingThickness = 0.05;

  // Start from floor 2 (index 1), skip ground floor
  for (let story = 1; story < stories; story++) {
    const floorY = story * storyHeight;

    for (let col = 0; col < cols; col++) {
      const cx = margin + actualSpacing * (col + 0.5) - faceWidth / 2;

      // Slab
      const slab = new THREE.BoxGeometry(balconyWidth, slabThickness, balconyDepth);
      slab.translate(cx, floorY, balconyDepth / 2);
      geos.push(slab);

      // Front railing
      const frontRail = new THREE.BoxGeometry(balconyWidth, railingHeight, railingThickness);
      frontRail.translate(cx, floorY + railingHeight / 2, balconyDepth);
      geos.push(frontRail);

      // Left railing
      const leftRail = new THREE.BoxGeometry(railingThickness, railingHeight, balconyDepth);
      leftRail.translate(cx - balconyWidth / 2, floorY + railingHeight / 2, balconyDepth / 2);
      geos.push(leftRail);

      // Right railing
      const rightRail = new THREE.BoxGeometry(railingThickness, railingHeight, balconyDepth);
      rightRail.translate(cx + balconyWidth / 2, floorY + railingHeight / 2, balconyDepth / 2);
      geos.push(rightRail);
    }
  }

  if (geos.length === 0) {
    // 1-story building — no balconies
    const empty = new THREE.BufferGeometry();
    empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    return empty;
  }

  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

// ─── Setback Body ───────────────────────────────────────────────────────

export interface SetbackSection {
  fromFloor: number;
  toFloor: number;
  width: number;
  depth: number;
  yOffset: number;
}

/**
 * Compute building sections for a setback. Returns section metadata and
 * box geometries for each section.
 */
export function createSetbackSections(
  width: number,
  depth: number,
  storyHeight: number,
  stories: number,
  setbackFloor: number,
  setbackAmount: number,
): { sections: SetbackSection[]; geometries: THREE.BufferGeometry[] } {
  const clampedFloor = Math.max(1, Math.min(stories - 1, setbackFloor));

  const lowerHeight = clampedFloor * storyHeight;
  const upperHeight = (stories - clampedFloor) * storyHeight;
  const upperWidth = Math.max(2, width - setbackAmount * 2);
  const upperDepth = Math.max(2, depth - setbackAmount * 2);

  const sections: SetbackSection[] = [
    {
      fromFloor: 0,
      toFloor: clampedFloor,
      width,
      depth,
      yOffset: 0,
    },
    {
      fromFloor: clampedFloor,
      toFloor: stories,
      width: upperWidth,
      depth: upperDepth,
      yOffset: lowerHeight,
    },
  ];

  const lowerGeo = new THREE.BoxGeometry(width, lowerHeight, depth);
  lowerGeo.translate(0, lowerHeight / 2, 0);

  const upperGeo = new THREE.BoxGeometry(upperWidth, upperHeight, upperDepth);
  upperGeo.translate(0, lowerHeight + upperHeight / 2, 0);

  return { sections, geometries: [lowerGeo, upperGeo] };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Merge an array of BufferGeometries into one (simple concat approach).
 * This avoids the heavy BufferGeometryUtils dependency.
 */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geos.length === 0) {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    empty.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(3), 3));
    empty.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(2), 2));
    return empty;
  }
  if (geos.length === 1) {
    return geos[0]!.clone();
  }

  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.getAttribute("position").count;
    totalIdx += g.index ? g.index.count : g.getAttribute("position").count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const indices: number[] = [];

  let vertOffset = 0;
  for (const g of geos) {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const norm = g.getAttribute("normal") as THREE.BufferAttribute | null;
    const uv = g.getAttribute("uv") as THREE.BufferAttribute | null;

    for (let i = 0; i < pos.count; i++) {
      positions[(vertOffset + i) * 3] = pos.getX(i);
      positions[(vertOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertOffset + i) * 3 + 2] = pos.getZ(i);

      if (norm) {
        normals[(vertOffset + i) * 3] = norm.getX(i);
        normals[(vertOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vertOffset + i) * 3 + 2] = norm.getZ(i);
      }

      if (uv) {
        uvs[(vertOffset + i) * 2] = uv.getX(i);
        uvs[(vertOffset + i) * 2 + 1] = uv.getY(i);
      }
    }

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices.push(g.index.getX(i) + vertOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(vertOffset + i);
      }
    }

    vertOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}
