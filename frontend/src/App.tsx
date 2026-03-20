import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import UploadPanel from "./components/UploadPanel";
import { useProjectStore } from "./store/projectStore";

export default function App() {
  const hasScene = useProjectStore((s) => s.sceneReady);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      <aside
        style={{
          width: 360,
          padding: 24,
          borderRight: "1px solid #222",
          overflowY: "auto",
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Icarus</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
          Upload drone footage to begin
        </p>
        <UploadPanel />
      </aside>
      <main style={{ flex: 1 }}>
        <Canvas camera={{ position: [20, 15, 20], fov: 60 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 20, 10]} intensity={1} />
          <Grid
            infiniteGrid
            cellSize={1}
            sectionSize={5}
            fadeDistance={100}
            cellColor="#333"
            sectionColor="#555"
          />
          <OrbitControls makeDefault />
        </Canvas>
      </main>
    </div>
  );
}
