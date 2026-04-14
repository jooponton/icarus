import { Button } from "@/components/ui/button";
import { useProjectStore } from "../store/projectStore";

export default function BackgroundControls() {
  const backgroundImageUrl = useProjectStore((s) => s.backgroundImageUrl);
  const setBackgroundImageUrl = useProjectStore((s) => s.setBackgroundImageUrl);
  const uploadedFiles = useProjectStore((s) => s.uploadedFiles);
  const projectId = useProjectStore((s) => s.projectId);
  const cameraPose = useProjectStore((s) => s.cameraPose);
  const cameraPoseLoading = useProjectStore((s) => s.cameraPoseLoading);
  const orbitLocked = useProjectStore((s) => s.orbitLocked);
  const setOrbitLocked = useProjectStore((s) => s.setOrbitLocked);
  const setCameraPose = useProjectStore((s) => s.setCameraPose);

  if (!backgroundImageUrl) return null;

  const imageFiles = uploadedFiles.filter(
    (f) => f.type === "image/jpeg" || f.type === "image/png",
  );

  function handleChange(fileName: string) {
    setBackgroundImageUrl(`/api/uploads/${projectId}/${fileName}`);
  }

  function handleResnap() {
    // Force re-apply the pose to the camera by toggling lock.
    setOrbitLocked(false);
    setTimeout(() => setOrbitLocked(true), 16);
  }

  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border px-3 py-2">
      <img
        src={backgroundImageUrl}
        alt="Background"
        className="h-8 w-12 rounded object-cover border border-border"
      />

      {imageFiles.length > 1 && (
        <select
          className="h-7 rounded bg-muted/50 border border-border px-2 text-[11px] text-foreground"
          value={backgroundImageUrl.split("/").pop() ?? ""}
          onChange={(e) => handleChange(e.target.value)}
        >
          {imageFiles.map((f) => (
            <option key={f.id} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-1 text-[10px] text-muted-foreground border-l border-border pl-2 ml-1">
        {cameraPoseLoading ? (
          <>
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span>estimating pose...</span>
          </>
        ) : cameraPose ? (
          <>
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="tabular-nums">
              {cameraPose.fov_deg.toFixed(0)}° / {cameraPose.pitch_deg.toFixed(0)}°p
              {" / "}
              {cameraPose.camera_height_m.toFixed(1)}m
            </span>
          </>
        ) : (
          <>
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            <span>no pose</span>
          </>
        )}
      </div>

      {cameraPose && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setOrbitLocked(!orbitLocked)}
            title={orbitLocked ? "Unlock camera to orbit" : "Lock camera to photo"}
          >
            {orbitLocked ? "Unlock" : "Lock"}
          </Button>
          {!orbitLocked && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={handleResnap}
              title="Reset view to photo"
            >
              Reset
            </Button>
          )}
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={() => {
          setBackgroundImageUrl(null);
          setCameraPose(null);
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </Button>
    </div>
  );
}
