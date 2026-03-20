import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import UploadPanel from "./components/UploadPanel";
import ArchitectChat from "./components/ArchitectChat";
import SpecPreview from "./components/SpecPreview";
import { useProjectStore } from "./store/projectStore";

export default function App() {
  const buildingSpec = useProjectStore((s) => s.buildingSpec);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      <aside
        style={{
          width: 380,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #222",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 20px 12px" }}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Icarus</h1>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
            AI Architectural Design Platform
          </p>
          <UploadPanel />
        </div>
        <div
          style={{
            flex: 1,
            padding: "0 20px 20px",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <ArchitectChat />
        </div>
        {buildingSpec && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #222",
              background: "#0d1117",
            }}
          >
            <SpecPreview spec={buildingSpec} />
          </div>
        )}
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
