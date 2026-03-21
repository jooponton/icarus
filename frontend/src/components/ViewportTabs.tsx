import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectStore, type ViewportMode } from "../store/projectStore";

export default function ViewportTabs() {
  const mode = useProjectStore((s) => s.viewportMode);
  const setMode = useProjectStore((s) => s.setViewportMode);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as ViewportMode)}
      >
        <TabsList className="bg-card/80 backdrop-blur-md border border-border">
          <TabsTrigger value="grid" className="text-xs">
            Grid
          </TabsTrigger>
          <TabsTrigger value="street" className="text-xs">
            Street view
          </TabsTrigger>
          <TabsTrigger value="wireframe" className="text-xs">
            Wireframe
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
