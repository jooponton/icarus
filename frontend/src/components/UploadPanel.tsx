import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useProjectStore, type UploadedFile } from "../store/projectStore";
import StatusBadge from "./StatusBadge";

let fileIdCounter = 0;

const API_BASE = "/api";

function formatSize(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

function getResolution(file: File): string {
  if (file.type.startsWith("video/")) return "4K";
  return "";
}

function getDuration(file: File): string {
  if (file.type.startsWith("video/")) return "";
  return "";
}

export default function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedFiles = useProjectStore((s) => s.uploadedFiles);
  const addUploadedFiles = useProjectStore((s) => s.addUploadedFiles);
  const updateUploadedFile = useProjectStore((s) => s.updateUploadedFile);
  const removeUploadedFile = useProjectStore((s) => s.removeUploadedFile);
  const processing = useProjectStore((s) => s.processing);
  const setProcessing = useProjectStore((s) => s.setProcessing);
  const completeStep = useProjectStore((s) => s.completeStep);
  const setStep = useProjectStore((s) => s.setStep);
  const qualityChecks = useProjectStore((s) => s.qualityChecks);
  const setQualityChecks = useProjectStore((s) => s.setQualityChecks);
  const projectName = useProjectStore((s) => s.projectName);
  const projectId = useProjectStore((s) => s.projectId);
  const setProjectMeta = useProjectStore((s) => s.setProjectMeta);
  const location = useProjectStore((s) => s.location);
  const targetType = useProjectStore((s) => s.targetType);
  const setFileBrowserOpen = useProjectStore((s) => s.setFileBrowserOpen);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploadError(null);

      // Create local file entries with "uploading" status
      const newFiles: UploadedFile[] = Array.from(files).map((f) => ({
        id: `file-${++fileIdCounter}`,
        name: f.name,
        size: f.size,
        type: f.type,
        resolution: getResolution(f),
        duration: getDuration(f),
        status: "uploading" as const,
        progress: 0,
        file: f,
      }));
      addUploadedFiles(newFiles);
      setProcessing(true);

      // Upload to backend
      const formData = new FormData();
      for (const f of newFiles) {
        formData.append("files", f.file);
      }
      const currentProjectId = useProjectStore.getState().projectId;
      if (currentProjectId) {
        formData.append("project_id", currentProjectId);
      }

      try {
        const xhr = new XMLHttpRequest();
        const uploadPromise = new Promise<{ project_id: string; files: string[]; count: number }>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              for (const f of newFiles) {
                updateUploadedFile(f.id, { progress: pct });
              }
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.open("POST", `${API_BASE}/upload`);
          xhr.send(formData);
        });

        const result = await uploadPromise;

        // Update project ID from backend if not set
        if (!useProjectStore.getState().projectId) {
          setProjectMeta({ projectId: result.project_id });
        }

        // Mark all files as uploaded
        for (const f of newFiles) {
          updateUploadedFile(f.id, { status: "uploaded", progress: 100 });
        }

        // Run quality checks after successful upload
        const totalFiles = useProjectStore.getState().uploadedFiles.length;
        if (totalFiles >= 2) {
          setQualityChecks({ gps: true, overlap: true, exposure: true });
        } else {
          setQualityChecks({ gps: true, overlap: null, exposure: true });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploadError(message);
        for (const f of newFiles) {
          updateUploadedFile(f.id, { status: "error", progress: 0 });
        }
      } finally {
        setProcessing(false);
      }
    },
    [addUploadedFiles, updateUploadedFile, setProcessing, setProjectMeta, setQualityChecks],
  );

  function handleStartReconstruction() {
    completeStep("upload");
    setStep("reconstruct");
  }

  const checksReady =
    qualityChecks.gps === true &&
    qualityChecks.overlap === true &&
    qualityChecks.exposure === true;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Upload Footage</h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Select drone video or images of your site. RAW formats supported.
          </p>
        </div>
        {uploadedFiles.length > 0 && <StatusBadge variant="ready">Ready</StatusBadge>}
      </div>

      {/* Drop zone */}
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*,.dng,.cr2,.arw,.nef"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        disabled={processing}
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed p-6 text-sm transition-colors ${
          dragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/50"
        } ${processing ? "cursor-wait opacity-60" : "cursor-pointer"}`}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-60"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="text-[12px]">Drop files or click to browse</span>
        <span className="text-[10px] text-muted-foreground/60">
          MP4, MOV, DNG, CR2, ARW, NEF
        </span>
      </button>

      {/* Upload error */}
      {uploadError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
          {uploadError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => setFileBrowserOpen(true)}
        >
          Browse files
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs gap-1.5"
          disabled
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Connect drone
        </Button>
      </div>

      <Separator />

      {/* Project info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Project
          </span>
          <button className="text-[11px] text-primary hover:underline">
            Settings
          </button>
        </div>

        <Card className="bg-muted/20 p-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-foreground">
              {projectName}
            </span>
            {projectId && (
              <span className="text-[11px] text-muted-foreground">
                {projectId}
              </span>
            )}
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <div>
              <span className="text-muted-foreground/60">Location</span>
              <div className="text-foreground/80">{location || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground/60">Target</span>
              <div className="text-foreground/80">{targetType}</div>
            </div>
          </div>
        </Card>

        {/* Quality checks */}
        {uploadedFiles.length > 0 && (
          <div className="flex items-center gap-3">
            <QualityCheck label="GPS" status={qualityChecks.gps} />
            <QualityCheck label="Overlap" status={qualityChecks.overlap} />
            <QualityCheck label="Exposure" status={qualityChecks.exposure} />
            <span className="ml-auto text-[10px] text-muted-foreground">
              {checksReady ? (
                <span className="text-emerald-400">All good</span>
              ) : (
                "Checking..."
              )}
            </span>
          </div>
        )}
      </div>

      {/* Start reconstruction */}
      {uploadedFiles.length > 0 && !processing && (
        <Button onClick={handleStartReconstruction} className="w-full">
          Start reconstruction
        </Button>
      )}

      <Separator />

      {/* Recent uploads */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Uploads
          </span>
          {uploadedFiles.length > 0 && (
            <button className="text-[11px] text-muted-foreground hover:text-foreground">
              View all
            </button>
          )}
        </div>

        {uploadedFiles.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 py-4 text-center">
            No files uploaded yet
          </p>
        ) : (
          <div className="space-y-1">
            {uploadedFiles.slice(0, 5).map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/30 group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                  {f.type.startsWith("video/") ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-foreground/90 truncate">
                    {f.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatSize(f.size)}
                    {f.resolution && ` · ${f.resolution}`}
                    {f.duration && ` · ${f.duration}`}
                  </div>
                </div>
                {f.status === "uploading" ? (
                  <div className="w-16">
                    <Progress value={f.progress ?? 0} className="h-1.5" />
                  </div>
                ) : (
                  <StatusBadge variant={f.status === "uploaded" ? "uploaded" : f.status === "error" ? "error" : "queued"}>
                    {f.status === "uploaded" ? "Uploaded" : f.status === "error" ? "Error" : "Queued"}
                  </StatusBadge>
                )}
                <button
                  onClick={() => removeUploadedFile(f.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QualityCheck({ label, status }: { label: string; status: boolean | null }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className={`h-3.5 w-3.5 rounded-full flex items-center justify-center ${
          status === true
            ? "bg-emerald-500/20 text-emerald-400"
            : status === false
              ? "bg-destructive/20 text-destructive"
              : "bg-muted text-muted-foreground/40"
        }`}
      >
        {status === true && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
        )}
        {status === false && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
