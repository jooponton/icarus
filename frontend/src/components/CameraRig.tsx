import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useProjectStore } from "../store/projectStore";

/**
 * Drives the active PerspectiveCamera from the ML-estimated camera pose so
 * the three.js view matches the photo's perspective. When `orbitLocked` is
 * true, the camera is snapped to the estimated pose every time the pose
 * changes; when false, OrbitControls owns the camera and the rig stays out
 * of the way so the user can freely orbit to edit the building.
 */
export default function CameraRig() {
  const { camera, size } = useThree();
  const cameraPose = useProjectStore((s) => s.cameraPose);
  const orbitLocked = useProjectStore((s) => s.orbitLocked);
  const lastAppliedRef = useRef<string | null>(null);

  // Match the projection to the photo's aspect + FOV whenever either changes.
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (!cameraPose) return;

    camera.fov = cameraPose.fov_deg;
    camera.aspect = size.width / size.height;
    camera.near = 0.1;
    camera.far = Math.max(1000, cameraPose.depth_max_m * 5);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, cameraPose]);

  // Snap to the photo's extrinsics when locked, on every pose change.
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (!cameraPose) {
      lastAppliedRef.current = null;
      return;
    }
    if (!orbitLocked) return;

    // Avoid reapplying the same pose on every render.
    const poseKey = `${cameraPose.source}:${cameraPose.pitch_deg}:${cameraPose.roll_deg}:${cameraPose.camera_height_m}`;
    if (lastAppliedRef.current === poseKey) return;
    lastAppliedRef.current = poseKey;

    // Place camera at (0, cam_height, 0) looking along -z (three.js forward).
    // Apply pitch (tilt down) + roll in three.js convention.
    camera.position.set(0, cameraPose.camera_height_m, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.set(
      THREE.MathUtils.degToRad(cameraPose.pitch_deg),
      0,
      THREE.MathUtils.degToRad(cameraPose.roll_deg),
    );
    camera.updateMatrixWorld();
  }, [camera, cameraPose, orbitLocked]);

  return null;
}
