import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ViewportToolbar from "./components/ViewportToolbar";
import { useProjectStore } from "./store/projectStore";

export default function App() {
  const currentStep = useProjectStore((s) => s.currentStep);

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col bg-background text-foreground">
        <Navbar />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="relative flex-1">
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
              <OrbitControls makeDefault />
            </Canvas>
            {currentStep === "upload" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-muted-foreground text-sm">
                  Upload drone footage to begin
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
