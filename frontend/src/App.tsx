import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ViewportToolbar from "./components/ViewportToolbar";
import FileBrowser from "./components/FileBrowser";
import ChatDrawer from "./components/ChatDrawer";
import BuildingScene from "./components/BuildingScene";
import SplatViewer from "./components/SplatViewer";
import BackgroundControls from "./components/BackgroundControls";
import PascalDesignEditor from "./components/PascalDesignEditor";
import CameraRig from "./components/CameraRig";
import ScenePostFX from "./components/ScenePostFX";
import BuildingTextureOverlay from "./components/BuildingTextureOverlay";
import ViewportEmptyState from "./components/ViewportEmptyState";
import ViewportPipelineBar from "./components/ViewportPipelineBar";
import { useProjectStore, type WorkflowStep } from "./store/projectStore";
import { useProjectRestore } from "./hooks/useProjectRestore";
import { useCameraPose } from "./hooks/useCameraPose";
import { useTextureGeneration } from "./hooks/useTextureGeneration";
import { useBackgroundDisplayUrl } from "./hooks/useBackgroundDisplayUrl";

export default function App() {
  const currentStep = useProjectStore((s) => s.currentStep);
  const viewportMode = useProjectStore((s) => s.viewportMode);
  const splatUrl = useProjectStore((s) => s.splatUrl);
  const backgroundImageUrl = useProjectStore((s) => s.backgroundImageUrl);
  const buildingSpec = useProjectStore((s) => s.buildingSpec);
  const cameraPose = useProjectStore((s) => s.cameraPose);
  const orbitLocked = useProjectStore((s) => s.orbitLocked);
  const setStep = useProjectStore((s) => s.setStep);
  const completeStep = useProjectStore((s) => s.completeStep);

  const showPascalEditor = currentStep === "design" && !!buildingSpec;

  // Restore project state from localStorage + backend on refresh
  useProjectRestore();
  // Estimate camera pose from the uploaded photo via the backend ML pipeline
  useCameraPose();
  // Kick off PBR texture generation as soon as a spec exists; survives nav.
  useTextureGeneration();
  // The backend's `/api/uploads/...` endpoint is now JWT-gated, so pull the
  // background through a blob: URL instead of letting CSS fetch it directly.
  const backgroundDisplayUrl = useBackgroundDisplayUrl();

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
      <div
        className="flex h-full w-full flex-col bg-background text-foreground"
        style={{
          backgroundImage:
            "radial-gradient(1200px 700px at 50% -20%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 55%), radial-gradient(900px 500px at 10% 10%, rgba(255,255,255,0.04), transparent 60%)",
        }}
      >
        <Navbar />
        <div className="flex flex-1 min-h-0 gap-4 lg:gap-6 p-4 lg:p-6">
          <Sidebar />
          <main
            className="relative flex-1 overflow-hidden rounded-2xl border border-border bg-card/30"
            style={backgroundDisplayUrl ? {
              backgroundImage: `url("${CSS.escape(backgroundDisplayUrl)}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            } : undefined}
          >
            {!showPascalEditor && <ViewportToolbar />}
            {showPascalEditor && <PascalDesignEditor />}
            {!showPascalEditor && <Canvas
              camera={{
                position: cameraPose
                  ? [0, cameraPose.camera_height_m, 0]
                  : [20, 15, 20],
                fov: cameraPose?.fov_deg ?? 60,
              }}
              gl={{ alpha: true }}
              style={{ background: "transparent" }}
            >
              <CameraRig />
              <ambientLight intensity={0.3} />
              <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
              <Environment preset="city" />
              {!splatUrl && !backgroundImageUrl && (
                <Grid
                  infiniteGrid
                  cellSize={1}
                  sectionSize={5}
                  fadeDistance={100}
                  cellColor="#222"
                  sectionColor="#444"
                />
              )}
              <SplatViewer />
              <BuildingScene wireframe={viewportMode === "wireframe"} />
              <ScenePostFX />
              <OrbitControls makeDefault enabled={!orbitLocked} />
            </Canvas>}
            {currentStep === "upload" && !backgroundImageUrl && !splatUrl && (
              <ViewportEmptyState />
            )}
            {!showPascalEditor && <ViewportPipelineBar />}
            <BackgroundControls />
          </main>
        </div>

        <footer className="shrink-0 px-4 pb-4 lg:px-6 lg:pb-5">
          <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Encrypted uploads · Local caching · Audit log
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-foreground">Support</a>
              <a href="#" className="hover:text-foreground">System status</a>
              <a href="#" className="hover:text-foreground">Privacy</a>
            </div>
          </div>
        </footer>
      </div>

      {/* Modals / Drawers */}
      <FileBrowser />
      <ChatDrawer />
      <BuildingTextureOverlay />
    </TooltipProvider>
  );
}
