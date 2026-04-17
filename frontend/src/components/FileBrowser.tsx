import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useProjectStore,
  type FileBrowserFilter,
  type FileBrowserSort,
  type UploadedFile,
} from "../store/projectStore";

const FILTERS: { key: FileBrowserFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Video" },
  { key: "raw", label: "RAW" },
];

const SORTS: { key: FileBrowserSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "name", label: "Name" },
  { key: "size", label: "Largest" },
];

const RAW_RE = /\.(dng|cr2|cr3|arw|nef|raf|rw2|orf|srw)$/i;

function formatSize(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function isImage(f: UploadedFile) {
  return f.type.startsWith("image/") || RAW_RE.test(f.name);
}

function isRaw(f: UploadedFile) {
  return RAW_RE.test(f.name);
}

function FileTile({
  f,
  isSelected,
  thumbnail,
  onClick,
}: {
  f: UploadedFile;
  isSelected: boolean;
  thumbnail: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col rounded-lg border p-2 text-left transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/20 hover:border-muted-foreground/30"
      }`}
    >
      <div className="aspect-video rounded-md bg-muted/40 flex items-center justify-center mb-2 overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={f.name}
            className="h-full w-full object-cover"
          />
        ) : f.type.startsWith("video/") ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-muted-foreground/40">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/40">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        )}
      </div>
      <div className="text-[11px] text-foreground/80 truncate">{f.name}</div>
      <div className="text-[10px] text-muted-foreground">
        {formatSize(f.size)}
        {f.resolution && ` · ${f.resolution}`}
      </div>
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary-foreground">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </button>
  );
}

export default function FileBrowser() {
  const open = useProjectStore((s) => s.fileBrowserOpen);
  const setOpen = useProjectStore((s) => s.setFileBrowserOpen);
  const filter = useProjectStore((s) => s.fileBrowserFilter);
  const setFilter = useProjectStore((s) => s.setFileBrowserFilter);
  const sort = useProjectStore((s) => s.fileBrowserSort);
  const setSort = useProjectStore((s) => s.setFileBrowserSort);
  const uploadedFiles = useProjectStore((s) => s.uploadedFiles);
  const selectedFiles = useProjectStore((s) => s.selectedBrowserFiles);
  const toggleSelection = useProjectStore((s) => s.toggleBrowserFileSelection);

  // Build object URL thumbnails for image files; revoke on cleanup.
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of uploadedFiles) {
      if (isImage(f) && !isRaw(f) && f.file) {
        next[f.id] = URL.createObjectURL(f.file);
      }
    }
    setThumbnails(next);
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
  }, [uploadedFiles]);

  const visible = useMemo(() => {
    const filtered = uploadedFiles.filter((f) => {
      if (filter === "all") return true;
      if (filter === "image") return isImage(f);
      if (filter === "video") return f.type.startsWith("video/");
      if (filter === "raw") return isRaw(f);
      return true;
    });
    const sorted = [...filtered];
    if (sort === "newest") {
      sorted.sort((a, b) => b.id.localeCompare(a.id));
    } else if (sort === "oldest") {
      sorted.sort((a, b) => a.id.localeCompare(b.id));
    } else if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "size") {
      sorted.sort((a, b) => b.size - a.size);
    }
    return sorted;
  }, [uploadedFiles, filter, sort]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col bg-card border-border gap-3">
        <DialogHeader>
          <DialogTitle className="text-[17px] tracking-tight text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>Browse Files</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FileBrowserFilter)}>
            <TabsList className="bg-muted/30">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.key} value={f.key} className="text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as FileBrowserSort)}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>
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
              Use selected
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {visible.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              {uploadedFiles.length === 0
                ? "No files uploaded yet"
                : "No files match this filter"}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {visible.map((f) => (
                <FileTile
                  key={f.id}
                  f={f}
                  isSelected={selectedFiles.has(f.id)}
                  thumbnail={thumbnails[f.id] ?? null}
                  onClick={() => toggleSelection(f.id)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
