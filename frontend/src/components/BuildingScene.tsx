import { useRef, useEffect } from "react";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { useProjectStore } from "../store/projectStore";
import CompoundBuilding from "./CompoundBuilding";

export default function BuildingScene({ wireframe = false }: { wireframe?: boolean }) {
  const buildingSpec = useProjectStore((s) => s.buildingSpec);
  const currentStep = useProjectStore((s) => s.currentStep);
  const placement = useProjectStore((s) => s.buildingPlacement);
  const setBuildingPlacement = useProjectStore((s) => s.setBuildingPlacement);
  const transformMode = useProjectStore((s) => s.transformMode);

  const meshDetailLevel = useProjectStore((s) => s.meshDetailLevel);
  const textureUrls = useProjectStore((s) => s.textureUrls);
  const setSceneGroup = useProjectStore((s) => s.setSceneGroup);

  const groupRef = useRef<THREE.Group>(null);
  const transformRef = useRef<React.ComponentRef<typeof TransformControls>>(null);

  const isPlaceStep = currentStep === "place";
  const showBuilding = buildingSpec && (currentStep === "design" || currentStep === "place" || currentStep === "export");

  // Register group ref for export
  useEffect(() => {
    if (showBuilding && groupRef.current) {
      setSceneGroup(groupRef.current);
    }
    return () => setSceneGroup(null);
  }, [showBuilding, setSceneGroup]);

  // Sync transform changes back to store
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    const handleChange = () => {
      const obj = groupRef.current;
      if (!obj) return;
      setBuildingPlacement({
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      });
    };

    // TransformControls uses "objectChange" event but drei types it on the underlying object
    (controls as any).addEventListener("objectChange", handleChange);
    return () => (controls as any).removeEventListener("objectChange", handleChange);
  }, [setBuildingPlacement]);

  if (!showBuilding) return null;

  return (
    <>
      <group
        ref={groupRef}
        position={placement.position}
        rotation={placement.rotation}
      >
        <CompoundBuilding spec={buildingSpec} wireframe={wireframe} detailLevel={meshDetailLevel} textureUrls={textureUrls} />
      </group>

      {isPlaceStep && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode={transformMode}
          size={0.75}
        />
      )}
    </>
  );
}
