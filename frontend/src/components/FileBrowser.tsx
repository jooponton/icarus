import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectStore, type FileBrowserFilter } from "../store/projectStore";

const FILTERS: { key: FileBrowserFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "video", label: "Video" },
  { key: "raw", label: "RAW Images" },
  { key: "gps", label: "GPS" },
  { key: "low-quality", label: "Low quality" },
];

function formatSize(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

export default function FileBrowser() {
  const open = useProjectStore((s) => s.fileBrowserOpen);
  const setOpen = useProjectStore((s) => s.setFileBrowserOpen);
  const filter = useProjectStore((s) => s.fileBrowserFilter);
  const setFilter = useProjectStore((s) => s.setFileBrowserFilter);
  const uploadedFiles = useProjectStore((s) => s.uploadedFiles);
  const selectedFiles = useProjectStore((s) => s.selectedBrowserFiles);
  const toggleSelection = useProjectStore((s) => s.toggleBrowserFileSelection);

  const filtered = uploadedFiles.filter((f) => {
    if (filter === "all") return true;
    if (filter === "video") return f.type.startsWith("video/");
    if (filter === "raw")
      return /\.(dng|cr2|arw|nef)$/i.test(f.name) || f.type.startsWith("image/");
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold">
              Browse files
            </DialogTitle>
            <div className="flex items-center gap-3">
              {selectedFiles.size > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {selectedFiles.size} selected
                </span>
              )}
              <Button
                size="sm"
                className="text-xs"
                disabled={selectedFiles.size === 0}
                onClick={() => setOpen(false)}
              >
                Upload selected
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filters */}
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FileBrowserFilter)}
        >
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/30">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.key} value={f.key} className="text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>Type: All</span>
              <span>Sort: Newest</span>
            </div>
          </div>
        </Tabs>

        {/* File grid */}
        <div className="flex-1 overflow-auto mt-2">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No files found
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((f) => {
                const isSelected = selectedFiles.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleSelection(f.id)}
                    className={`group relative rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/20 hover:border-muted-foreground/30"
                    }`}
                  >
                    {/* Thumbnail placeholder */}
                    <div className="h-24 rounded-md bg-muted/40 flex items-center justify-center mb-2">
                      {f.type.startsWith("video/") ? (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="text-muted-foreground/40"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      ) : (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="text-muted-foreground/40"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      )}
                    </div>
                    <div className="text-[11px] text-foreground/80 truncate">
                      {f.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatSize(f.size)}
                      {f.resolution && ` · ${f.resolution}`}
                    </div>
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-primary-foreground"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    {/* Tags */}
                    {f.tags && f.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {f.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
