import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BuildingSpec } from "../store/projectStore";

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

interface Props {
  spec: BuildingSpec;
  wireframe?: boolean;
}

export default function ProceduralBuilding({ spec, wireframe = false }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  const storyHeight = 3.2;
  const width = spec.footprint_width || 10;
  const depth = spec.footprint_depth || 8;
  const stories = spec.stories || 2;
  const totalHeight = stories * storyHeight;

  const materialColor = MATERIAL_COLORS[spec.material?.toLowerCase()] ?? "#b0a89a";
  const roofColor = ROOF_COLORS[spec.roof_style?.toLowerCase()] ?? "#666";
  const roofStyle = spec.roof_style?.toLowerCase() ?? "flat";

  // Generate floor lines geometry
  const floorLines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 1; i < stories; i++) {
      const y = i * storyHeight;
      // Front face
      points.push(new THREE.Vector3(-width / 2, y, depth / 2));
      points.push(new THREE.Vector3(width / 2, y, depth / 2));
      // Right face
      points.push(new THREE.Vector3(width / 2, y, depth / 2));
      points.push(new THREE.Vector3(width / 2, y, -depth / 2));
      // Back face
      points.push(new THREE.Vector3(width / 2, y, -depth / 2));
      points.push(new THREE.Vector3(-width / 2, y, -depth / 2));
      // Left face
      points.push(new THREE.Vector3(-width / 2, y, -depth / 2));
      points.push(new THREE.Vector3(-width / 2, y, depth / 2));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [width, depth, stories, storyHeight]);

  // Roof geometry
  const roof = useMemo(() => {
    if (roofStyle === "gabled" || roofStyle === "hip") {
      const shape = new THREE.Shape();
      const overhang = 0.5;
      const hw = width / 2 + overhang;
      const peak = 3;
      shape.moveTo(-hw, 0);
      shape.lineTo(0, peak);
      shape.lineTo(hw, 0);
      shape.lineTo(-hw, 0);

      if (roofStyle === "gabled") {
        const extrudeSettings = {
          depth: depth + overhang * 2,
          bevelEnabled: false,
        };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, 0, depth / 2 + overhang);
        return geo;
      }
      // Hip roof — use a simpler cone-like shape
      const geo = new THREE.ConeGeometry(
        Math.max(width, depth) / 2 + overhang,
        peak,
        4,
      );
      geo.rotateY(Math.PI / 4);
      return geo;
    }
    if (roofStyle === "shed") {
      const geo = new THREE.BoxGeometry(width + 1, 0.3, depth + 1);
      geo.translate(0, 0.8, 0);
      // Tilt it
      const matrix = new THREE.Matrix4().makeRotationX(-0.15);
      geo.applyMatrix4(matrix);
      return geo;
    }
    // Flat roof — simple slab
    return new THREE.BoxGeometry(width + 0.4, 0.3, depth + 0.4);
  }, [width, depth, roofStyle]);

  // Subtle hover pulse
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (matRef.current && wireframe) {
      matRef.current.opacity = 0.4 + Math.sin(Date.now() * 0.003) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main body */}
      <mesh position={[0, totalHeight / 2, 0]}>
        <boxGeometry args={[width, totalHeight, depth]} />
        <meshStandardMaterial
          ref={matRef}
          color={materialColor}
          wireframe={wireframe}
          transparent={wireframe}
          opacity={wireframe ? 0.5 : 1}
        />
      </mesh>

      {/* Floor dividers */}
      {!wireframe && (
        <lineSegments position={[0, 0, 0]}>
          <primitive object={floorLines} attach="geometry" />
          <lineBasicMaterial color="#00000033" />
        </lineSegments>
      )}

      {/* Roof */}
      <mesh position={[0, totalHeight + (roofStyle === "flat" ? 0.15 : 1.5), 0]}>
        <primitive object={roof} attach="geometry" />
        <meshStandardMaterial
          color={roofColor}
          wireframe={wireframe}
          transparent={wireframe}
          opacity={wireframe ? 0.5 : 1}
        />
      </mesh>

      {/* Ground shadow hint */}
      {!wireframe && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[width + 2, depth + 2]} />
          <meshStandardMaterial color="#000" transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  );
}
