import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BuildingSpec, PbrTextureUrls } from "../store/projectStore";
import { getStyleConfig, getDetailLevelMultiplier } from "../lib/buildingStyles";
import { usePbrMaterial } from "../hooks/usePbrMaterial";
import {
  createWindowGrid,
  createDoorGeometry,
  createCorniceGeometry,
  createPilasterGeometry,
  createMansardRoof,
  createButterflyRoof,
  createParapetGeometry,
  createStorefrontGeometry,
  createBalconyGeometry,
  createSetbackSections,
} from "../lib/buildingGeometry";

const MATERIAL_COLORS: Record<string, string> = {
  concrete: "#b0a89a",
  brick: "#a0522d",
  glass: "#88ccdd",
  steel: "#8899aa",
  wood: "#c4a56e",
  stone: "#8a8a7a",
};

const ROOF_COLORS: Record<string, string> = {
  flat: "#666",
  gabled: "#7a4a2a",
  hip: "#7a4a2a",
  shed: "#666",
  mansard: "#4a4a5a",
  butterfly: "#666",
};

const GLASS_COLOR = "#4488aa";
const STOREFRONT_GLASS = "#5599bb";
const FRAME_COLOR = "#333333";
const DOOR_COLOR = "#3a2a1a";
const BALCONY_COLOR = "#777777";

interface Props {
  spec: BuildingSpec;
  wireframe?: boolean;
  detailLevel?: number;
  textureUrls?: PbrTextureUrls | null;
}

export default function ProceduralBuilding({
  spec,
  wireframe = false,
  detailLevel = 75,
  textureUrls = null,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);

  const storyHeight = 3.2;
  const width = spec.footprint_width || 10;
  const depth = spec.footprint_depth || 8;
  const stories = spec.stories || 2;
  const totalHeight = stories * storyHeight;

  const materialColor = MATERIAL_COLORS[spec.material?.toLowerCase()] ?? "#b0a89a";
  const roofColor = ROOF_COLORS[spec.roof_style?.toLowerCase()] ?? "#666";
  const roofStyle = spec.roof_style?.toLowerCase() ?? "flat";

  // Style config and detail multiplier
  const styleConfig = useMemo(
    () => getStyleConfig(spec.style ?? "modern", spec.building_type ?? "residential"),
    [spec.style, spec.building_type],
  );
  const detailMult = useMemo(() => getDetailLevelMultiplier(detailLevel), [detailLevel]);

  // Texture loading (falls back to flat colors when URLs are null)
  const wallTex = usePbrMaterial(textureUrls?.wall ?? null, materialColor, width / 2, totalHeight / 2);
  const roofTex = usePbrMaterial(textureUrls?.roof ?? null, roofColor, 2, 2);
  const doorTex = usePbrMaterial(textureUrls?.door ?? null, DOOR_COLOR, 1, 1);
  const trimTex = usePbrMaterial(textureUrls?.trim ?? null, FRAME_COLOR, 1, 1);

  // Setback sections
  const hasSetback = styleConfig.setbackAfterFloor !== null && stories > (styleConfig.setbackAfterFloor ?? 0);
  const setback = useMemo(() => {
    if (!hasSetback || styleConfig.setbackAfterFloor === null) return null;
    return createSetbackSections(
      width, depth, storyHeight, stories,
      styleConfig.setbackAfterFloor, styleConfig.setbackAmount,
    );
  }, [hasSetback, width, depth, storyHeight, stories, styleConfig.setbackAfterFloor, styleConfig.setbackAmount]);

  // For setback buildings, use the top section dimensions for roof placement
  const roofWidth = setback ? setback.sections[1]!.width : width;
  const roofDepth = setback ? setback.sections[1]!.depth : depth;

  // Floor lines
  const floorLines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    if (setback) {
      for (const section of setback.sections) {
        const sw = section.width;
        const sd = section.depth;
        for (let i = section.fromFloor + 1; i < section.toFloor; i++) {
          const y = i * storyHeight;
          points.push(new THREE.Vector3(-sw / 2, y, sd / 2));
          points.push(new THREE.Vector3(sw / 2, y, sd / 2));
          points.push(new THREE.Vector3(sw / 2, y, sd / 2));
          points.push(new THREE.Vector3(sw / 2, y, -sd / 2));
          points.push(new THREE.Vector3(sw / 2, y, -sd / 2));
          points.push(new THREE.Vector3(-sw / 2, y, -sd / 2));
          points.push(new THREE.Vector3(-sw / 2, y, -sd / 2));
          points.push(new THREE.Vector3(-sw / 2, y, sd / 2));
        }
      }
    } else {
      for (let i = 1; i < stories; i++) {
        const y = i * storyHeight;
        points.push(new THREE.Vector3(-width / 2, y, depth / 2));
        points.push(new THREE.Vector3(width / 2, y, depth / 2));
        points.push(new THREE.Vector3(width / 2, y, depth / 2));
        points.push(new THREE.Vector3(width / 2, y, -depth / 2));
        points.push(new THREE.Vector3(width / 2, y, -depth / 2));
        points.push(new THREE.Vector3(-width / 2, y, -depth / 2));
        points.push(new THREE.Vector3(-width / 2, y, -depth / 2));
        points.push(new THREE.Vector3(-width / 2, y, depth / 2));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [width, depth, stories, storyHeight, setback]);

  // Windows — one grid per face (skip ground floor on front if storefront)
  const windows = useMemo(() => {
    const skipFrontGround = styleConfig.hasStorefront;
    const front = createWindowGrid(width, stories, storyHeight, styleConfig, detailMult, true, skipFrontGround);
    const back = createWindowGrid(width, stories, storyHeight, styleConfig, detailMult, false);
    const left = createWindowGrid(depth, stories, storyHeight, styleConfig, detailMult, false);
    const right = createWindowGrid(depth, stories, storyHeight, styleConfig, detailMult, false);
    return { front, back, left, right };
  }, [width, depth, stories, storyHeight, styleConfig, detailMult]);

  // Door
  const door = useMemo(
    () => createDoorGeometry(styleConfig.doorWidth, styleConfig.doorHeight, styleConfig.doubleDoor),
    [styleConfig.doorWidth, styleConfig.doorHeight, styleConfig.doubleDoor],
  );

  // Cornices
  const corniceGeo = useMemo(() => {
    if (!styleConfig.hasCornices) return null;
    return createCorniceGeometry(
      width, depth, storyHeight, stories,
      styleConfig.corniceHeight, styleConfig.corniceDepth,
    );
  }, [width, depth, storyHeight, stories, styleConfig]);

  // Pilasters
  const pilasterGeo = useMemo(() => {
    if (!styleConfig.hasPilasters) return null;
    return createPilasterGeometry(
      totalHeight, styleConfig.pilasterWidth, styleConfig.pilasterDepth, width, depth,
    );
  }, [totalHeight, width, depth, styleConfig]);

  // Parapets
  const parapetGeo = useMemo(() => {
    if (!styleConfig.hasParapet) return null;
    return createParapetGeometry(
      roofWidth, roofDepth,
      styleConfig.parapetHeight, styleConfig.parapetThickness,
    );
  }, [roofWidth, roofDepth, styleConfig]);

  // Storefronts
  const storefront = useMemo(() => {
    if (!styleConfig.hasStorefront) return null;
    return createStorefrontGeometry(width, styleConfig.storefrontHeight, storyHeight);
  }, [width, storyHeight, styleConfig]);

  // Balconies (front face)
  const balconyGeo = useMemo(() => {
    if (!styleConfig.hasBalconies || stories < 2) return null;
    return createBalconyGeometry(
      width, stories, storyHeight,
      styleConfig.balconyWidth, styleConfig.balconyDepth, styleConfig.balconySpacing,
    );
  }, [width, stories, storyHeight, styleConfig]);

  // Roof
  const roof = useMemo(() => {
    if (roofStyle === "gabled" || roofStyle === "hip") {
      const overhang = 0.5;
      const peak = 3;
      if (roofStyle === "gabled") {
        const shape = new THREE.Shape();
        const hw = roofWidth / 2 + overhang;
        shape.moveTo(-hw, 0);
        shape.lineTo(0, peak);
        shape.lineTo(hw, 0);
        shape.lineTo(-hw, 0);
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: roofDepth + overhang * 2,
          bevelEnabled: false,
        });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, 0, roofDepth / 2 + overhang);
        return { geo, offset: 0 };
      }
      // Hip roof
      const geo = new THREE.ConeGeometry(
        Math.max(roofWidth, roofDepth) / 2 + overhang, peak, 4,
      );
      geo.rotateY(Math.PI / 4);
      return { geo, offset: peak / 2 };
    }
    if (roofStyle === "shed") {
      const geo = new THREE.BoxGeometry(roofWidth + 1, 0.3, roofDepth + 1);
      geo.translate(0, 0.8, 0);
      geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.15));
      return { geo, offset: 0 };
    }
    if (roofStyle === "mansard") {
      const geo = createMansardRoof(roofWidth, roofDepth);
      return { geo, offset: 0 };
    }
    if (roofStyle === "butterfly") {
      const geo = createButterflyRoof(roofWidth, roofDepth);
      return { geo, offset: 0 };
    }
    // Flat roof
    return {
      geo: new THREE.BoxGeometry(roofWidth + 0.4, 0.3, roofDepth + 0.4),
      offset: 0.15,
    };
  }, [roofWidth, roofDepth, roofStyle]);

  // Dispose geometries when they change or on unmount
  useEffect(() => {
    return () => { floorLines.dispose(); };
  }, [floorLines]);

  useEffect(() => {
    return () => {
      for (const face of Object.values(windows)) {
        face.glass.dispose();
        face.frame?.dispose();
      }
    };
  }, [windows]);

  useEffect(() => {
    return () => {
      door.door.dispose();
      door.frame.dispose();
    };
  }, [door]);

  useEffect(() => {
    return () => { corniceGeo?.dispose(); };
  }, [corniceGeo]);

  useEffect(() => {
    return () => { pilasterGeo?.dispose(); };
  }, [pilasterGeo]);

  useEffect(() => {
    return () => { parapetGeo?.dispose(); };
  }, [parapetGeo]);

  useEffect(() => {
    return () => {
      storefront?.glass.dispose();
      storefront?.mullions.dispose();
    };
  }, [storefront]);

  useEffect(() => {
    return () => { balconyGeo?.dispose(); };
  }, [balconyGeo]);

  useEffect(() => {
    return () => { roof.geo.dispose(); };
  }, [roof]);

  useEffect(() => {
    return () => {
      if (setback) {
        for (const g of setback.geometries) g.dispose();
      }
    };
  }, [setback]);

  // Wireframe pulse
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (matRef.current && wireframe) {
      matRef.current.opacity = 0.4 + Math.sin(Date.now() * 0.003) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main body */}
      {setback ? (
        // Setback: render multiple box sections
        setback.geometries.map((geo, i) => (
          <mesh key={i}>
            <primitive object={geo} attach="geometry" />
            <meshStandardMaterial
              ref={i === 0 ? matRef : undefined}
              {...wallTex}
              wireframe={wireframe}
              transparent={wireframe}
              opacity={wireframe ? 0.5 : 1}
            />
          </mesh>
        ))
      ) : (
        <mesh position={[0, totalHeight / 2, 0]}>
          <boxGeometry args={[width, totalHeight, depth]} />
          <meshStandardMaterial
            ref={matRef}
            {...wallTex}
            wireframe={wireframe}
            transparent={wireframe}
            opacity={wireframe ? 0.5 : 1}
          />
        </mesh>
      )}

      {/* ── Windows ── */}
      {!wireframe && (
        <>
          {/* Front face windows */}
          <mesh position={[0, 0, depth / 2 + 0.002]}>
            <primitive object={windows.front.glass} attach="geometry" />
            <meshStandardMaterial color={GLASS_COLOR} metalness={0.6} roughness={0.15} />
          </mesh>
          {windows.front.frame && (
            <mesh position={[0, 0, depth / 2 + 0.001]}>
              <primitive object={windows.front.frame} attach="geometry" />
              <meshStandardMaterial {...trimTex} />
            </mesh>
          )}

          {/* Back face windows */}
          <mesh position={[0, 0, -(depth / 2 + 0.002)]} rotation={[0, Math.PI, 0]}>
            <primitive object={windows.back.glass} attach="geometry" />
            <meshStandardMaterial color={GLASS_COLOR} metalness={0.6} roughness={0.15} />
          </mesh>
          {windows.back.frame && (
            <mesh position={[0, 0, -(depth / 2 + 0.001)]} rotation={[0, Math.PI, 0]}>
              <primitive object={windows.back.frame} attach="geometry" />
              <meshStandardMaterial {...trimTex} />
            </mesh>
          )}

          {/* Left face windows */}
          <mesh position={[-(width / 2 + 0.002), 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <primitive object={windows.left.glass} attach="geometry" />
            <meshStandardMaterial color={GLASS_COLOR} metalness={0.6} roughness={0.15} />
          </mesh>
          {windows.left.frame && (
            <mesh position={[-(width / 2 + 0.001), 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <primitive object={windows.left.frame} attach="geometry" />
              <meshStandardMaterial {...trimTex} />
            </mesh>
          )}

          {/* Right face windows */}
          <mesh position={[width / 2 + 0.002, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <primitive object={windows.right.glass} attach="geometry" />
            <meshStandardMaterial color={GLASS_COLOR} metalness={0.6} roughness={0.15} />
          </mesh>
          {windows.right.frame && (
            <mesh position={[width / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <primitive object={windows.right.frame} attach="geometry" />
              <meshStandardMaterial {...trimTex} />
            </mesh>
          )}

          {/* ── Storefront (front face ground floor) ── */}
          {storefront && (
            <>
              <mesh position={[0, 0, depth / 2 + 0.004]}>
                <primitive object={storefront.glass} attach="geometry" />
                <meshStandardMaterial color={STOREFRONT_GLASS} metalness={0.7} roughness={0.1} transparent opacity={0.85} />
              </mesh>
              <mesh position={[0, 0, depth / 2 + 0.003]}>
                <primitive object={storefront.mullions} attach="geometry" />
                <meshStandardMaterial {...trimTex} />
              </mesh>
            </>
          )}

          {/* ── Door (front face) ── */}
          {!styleConfig.hasStorefront && (
            <>
              <mesh position={[0, 0, depth / 2 + 0.003]}>
                <primitive object={door.door} attach="geometry" />
                <meshStandardMaterial {...doorTex} />
              </mesh>
              <mesh position={[0, 0, depth / 2 + 0.0025]}>
                <primitive object={door.frame} attach="geometry" />
                <meshStandardMaterial {...trimTex} />
              </mesh>
            </>
          )}
        </>
      )}

      {/* ── Cornices ── */}
      {!wireframe && corniceGeo && (
        <mesh>
          <primitive object={corniceGeo} attach="geometry" />
          <meshStandardMaterial {...wallTex} />
        </mesh>
      )}

      {/* ── Pilasters ── */}
      {!wireframe && pilasterGeo && (
        <mesh>
          <primitive object={pilasterGeo} attach="geometry" />
          <meshStandardMaterial {...wallTex} />
        </mesh>
      )}

      {/* ── Parapets ── */}
      {!wireframe && parapetGeo && (
        <mesh position={[0, totalHeight, 0]}>
          <primitive object={parapetGeo} attach="geometry" />
          <meshStandardMaterial {...wallTex} />
        </mesh>
      )}

      {/* ── Balconies (front face) ── */}
      {!wireframe && balconyGeo && (
        <mesh position={[0, 0, depth / 2]}>
          <primitive object={balconyGeo} attach="geometry" />
          <meshStandardMaterial color={BALCONY_COLOR} roughness={0.7} />
        </mesh>
      )}

      {/* Floor dividers */}
      {!wireframe && (
        <lineSegments>
          <primitive object={floorLines} attach="geometry" />
          <lineBasicMaterial color="#00000033" />
        </lineSegments>
      )}

      {/* Roof */}
      <mesh position={[0, totalHeight + roof.offset, 0]}>
        <primitive object={roof.geo} attach="geometry" />
        <meshStandardMaterial
          {...roofTex}
          wireframe={wireframe}
          transparent={wireframe}
          opacity={wireframe ? 0.5 : 1}
        />
      </mesh>

      {/* Ground shadow */}
      {!wireframe && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[width + 2, depth + 2]} />
          <meshStandardMaterial color="#000" transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  );
}
