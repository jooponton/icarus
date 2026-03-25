import { Button } from "@/components/ui/button";
import { useProjectStore } from "../store/projectStore";

export default function BackgroundControls() {
  const backgroundImageUrl = useProjectStore((s) => s.backgroundImageUrl);
  const setBackgroundImageUrl = useProjectStore((s) => s.setBackgroundImageUrl);
  const uploadedFiles = useProjectStore((s) => s.uploadedFiles);
  const projectId = useProjectStore((s) => s.projectId);

  if (!backgroundImageUrl) return null;

  const imageFiles = uploadedFiles.filter(
    (f) => f.type === "image/jpeg" || f.type === "image/png",
  );

  function handleChange(fileName: string) {
    setBackgroundImageUrl(`/api/uploads/${projectId}/${fileName}`);
  }

  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border px-3 py-2">
      {/* Thumbnail */}
      <img
        src={backgroundImageUrl}
        alt="Background"
        className="h-8 w-12 rounded object-cover border border-border"
      />

      {/* Cycle through uploaded images */}
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

      {/* Remove */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={() => setBackgroundImageUrl(null)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </Button>
    </div>
  );
}
