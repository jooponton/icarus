import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ViewportToolbar from "./components/ViewportToolbar";
import ViewportTabs from "./components/ViewportTabs";
import FileBrowser from "./components/FileBrowser";
import ChatDrawer from "./components/ChatDrawer";
import { useProjectStore, type WorkflowStep } from "./store/projectStore";

export default function App() {
  const currentStep = useProjectStore((s) => s.currentStep);
  const viewportMode = useProjectStore((s) => s.viewportMode);
  const setStep = useProjectStore((s) => s.setStep);
  const completeStep = useProjectStore((s) => s.completeStep);

  // Dev: ?step=reconstruct to jump to any step
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const step = params.get("step") as WorkflowStep | null;
    if (step) {
      const steps: WorkflowStep[] = ["upload", "reconstruct", "design", "place", "export"];
      const idx = steps.indexOf(step);
      if (idx >= 0) {
        for (let i = 0; i < idx; i++) completeStep(steps[i]!);
        setStep(step);
      }
    }
  }, [setStep, completeStep]);

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col bg-background text-foreground">
        <Navbar />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="relative flex-1">
            <ViewportTabs />
            <ViewportToolbar />
            <Canvas camera={{ position: [20, 15, 20], fov: 60 }}>
              <ambientLight intensity={0.4} />
              <directionalLight position={[10, 20, 10]} intensity={1} />
              <Grid
                infiniteGrid
                cellSize={1}
                sectionSize={5}
                fadeDistance={100}
                cellColor="#222"
                sectionColor="#444"
              />
              {viewportMode === "wireframe" && (
                <mesh position={[0, 4, 0]}>
                  <boxGeometry args={[8, 8, 6]} />
                  <meshStandardMaterial
                    color="#888"
                    wireframe
                    transparent
                    opacity={0.6}
                  />
                </mesh>
              )}
              <OrbitControls makeDefault />
            </Canvas>
            {currentStep === "upload" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <p className="text-muted-foreground/40 text-sm">
                  Upload drone footage to begin
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modals / Drawers */}
      <FileBrowser />
      <ChatDrawer />
    </TooltipProvider>
  );
}
