import { Splat } from "@react-three/drei";
import { useProjectStore } from "../store/projectStore";

export default function SplatViewer() {
  const splatUrl = useProjectStore((s) => s.splatUrl);
  const currentStep = useProjectStore((s) => s.currentStep);

  // Show splat once ready, across reconstruct through export
  const visibleSteps = ["reconstruct", "design", "place", "export"];
  if (!splatUrl || !visibleSteps.includes(currentStep)) return null;

  return (
    <Splat
      src={splatUrl}
      toneMapped={false}
      alphaTest={0.1}
    />
  );
}
