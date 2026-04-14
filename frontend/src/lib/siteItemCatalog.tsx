import type { ReactNode } from "react";
import type { SiteItemType } from "../store/projectStore";

interface ItemMeta {
  label: string;
  render: () => ReactNode;
}

function GasPump() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.9, 0.3, 0.6]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.7, 1.3, 0.5]} />
        <meshStandardMaterial color="#c0392b" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.45, 0.26]}>
        <boxGeometry args={[0.5, 0.35, 0.05]} />
        <meshStandardMaterial color="#111" roughness={0.3} />
      </mesh>
      <mesh position={[0.3, 0.85, 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.25, 12]} />
        <meshStandardMaterial color="#333" roughness={0.5} />
      </mesh>
    </group>
  );
}

function PumpCanopy() {
  return (
    <group>
      {[
        [-5, -2.5],
        [5, -2.5],
        [-5, 2.5],
        [5, 2.5],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.5, z]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 5, 16]} />
          <meshStandardMaterial color="#cfcfcf" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 5.15, 0]} castShadow>
        <boxGeometry args={[11, 0.3, 6]} />
        <meshStandardMaterial color="#f2f2f2" roughness={0.6} />
      </mesh>
      <mesh position={[0, 5.32, 0]}>
        <boxGeometry args={[11.2, 0.04, 6.2]} />
        <meshStandardMaterial color="#c0392b" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Bollard() {
  return (
    <mesh position={[0, 0.5, 0]} castShadow>
      <cylinderGeometry args={[0.12, 0.15, 1, 16]} />
      <meshStandardMaterial color="#f1c40f" roughness={0.5} />
    </mesh>
  );
}

function LightPole() {
  return (
    <group>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 5, 12]} />
        <meshStandardMaterial color="#444" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0.5, 4.95, 0]} castShadow>
        <boxGeometry args={[1.0, 0.1, 0.25]} />
        <meshStandardMaterial color="#333" roughness={0.5} />
      </mesh>
      <mesh position={[0.9, 4.85, 0]}>
        <boxGeometry args={[0.35, 0.15, 0.25]} />
        <meshStandardMaterial
          color="#fff8cc"
          emissive="#fff4a0"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

function ParkingStripe() {
  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.2, 5]} />
      <meshStandardMaterial color="#f5f5f5" roughness={0.8} />
    </mesh>
  );
}

function Curb() {
  return (
    <mesh position={[0, 0.08, 0]} castShadow>
      <boxGeometry args={[4, 0.16, 0.3]} />
      <meshStandardMaterial color="#a9a9a9" roughness={0.8} />
    </mesh>
  );
}

function Dumpster() {
  return (
    <group>
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[2, 1.3, 1.5]} />
        <meshStandardMaterial color="#1e6b3a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.35, 0]} rotation={[0.1, 0, 0]} castShadow>
        <boxGeometry args={[2.05, 0.08, 1.55]} />
        <meshStandardMaterial color="#15552d" roughness={0.5} />
      </mesh>
    </group>
  );
}

function HvacUnit() {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.5, 0.8, 1.2]} />
        <meshStandardMaterial color="#cfcfcf" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.81, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.05, 20]} />
        <meshStandardMaterial color="#222" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Tree() {
  return (
    <group>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 2, 10]} />
        <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.7, 0]} castShadow>
        <sphereGeometry args={[1.1, 16, 12]} />
        <meshStandardMaterial color="#3a6b32" roughness={0.8} />
      </mesh>
      <mesh position={[0.4, 3.3, 0.2]} castShadow>
        <sphereGeometry args={[0.7, 12, 10]} />
        <meshStandardMaterial color="#4d7a3a" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Bench() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.6, 0.08, 0.4]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.75, -0.16]} castShadow>
        <boxGeometry args={[1.6, 0.5, 0.06]} />
        <meshStandardMaterial color="#7a4a2a" roughness={0.7} />
      </mesh>
      {[-0.7, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 0.22, 0]} castShadow>
          <boxGeometry args={[0.08, 0.45, 0.4]} />
          <meshStandardMaterial color="#222" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function TrashCan() {
  return (
    <mesh position={[0, 0.45, 0]} castShadow>
      <cylinderGeometry args={[0.3, 0.28, 0.9, 16]} />
      <meshStandardMaterial color="#444" roughness={0.6} metalness={0.3} />
    </mesh>
  );
}

function SignPole() {
  return (
    <group>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 3, 10]} />
        <meshStandardMaterial color="#555" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 2.8, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.05]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
    </group>
  );
}

export const SITE_ITEM_CATALOG: Record<SiteItemType, ItemMeta> = {
  gas_pump: { label: "Gas pump", render: () => <GasPump /> },
  pump_canopy: { label: "Pump canopy", render: () => <PumpCanopy /> },
  bollard: { label: "Bollard", render: () => <Bollard /> },
  light_pole: { label: "Light pole", render: () => <LightPole /> },
  parking_stripe: { label: "Parking stripe", render: () => <ParkingStripe /> },
  curb: { label: "Curb", render: () => <Curb /> },
  dumpster: { label: "Dumpster", render: () => <Dumpster /> },
  hvac_unit: { label: "HVAC unit", render: () => <HvacUnit /> },
  tree: { label: "Tree", render: () => <Tree /> },
  bench: { label: "Bench", render: () => <Bench /> },
  trash_can: { label: "Trash can", render: () => <TrashCan /> },
  sign_pole: { label: "Sign pole", render: () => <SignPole /> },
};
