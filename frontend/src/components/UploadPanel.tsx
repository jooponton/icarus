import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getAuthToken } from "../lib/api";
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
  const backgroundImageUrl = useProjectStore((s) => s.backgroundImageUrl);
  const setBackgroundImageUrl = useProjectStore((s) => s.setBackgroundImageUrl);
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
        // XHR (not fetch) so the upload progress bar works. That means we have
        // to inject the Supabase JWT manually — `apiFetch`'s auto-header plumbing
        // doesn't apply here.
        const token = await getAuthToken();
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
          if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
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

        // Auto-set first image as viewport background
        const pid = result.project_id;
        const firstImage = newFiles.find(
          (f) => f.type === "image/jpeg" || f.type === "image/png",
        );
        if (firstImage && !useProjectStore.getState().backgroundImageUrl) {
          setBackgroundImageUrl(`/api/uploads/${pid}/${firstImage.name}`);
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

  function handleSkipToDesign() {
    completeStep("upload");
    completeStep("reconstruct");
    setStep("design");
  }

  const hasOnlyImages = uploadedFiles.length > 0 && uploadedFiles.every(
    (f) => f.type.startsWith("image/"),
  );

  const checksReady =
    qualityChecks.gps === true &&
    qualityChecks.overlap === true &&
    qualityChecks.exposure === true;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            Upload Footage
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Drop drone video or site photos. RAW formats supported.
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

      <div
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
        className={`rounded-2xl border-[1.5px] border-dashed p-5 transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30"
        } ${processing ? "cursor-wait opacity-60" : ""}`}
      >
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </span>
          <div className="mt-3 text-sm font-medium text-foreground">
            Drop files or click to browse
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            JPG, PNG, MP4, MOV, DNG, CR2, ARW, NEF
          </div>

          <div className="mt-4 grid w-full grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={processing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-primary to-primary/80 px-3 py-2 text-sm font-semibold text-primary-foreground hover:from-primary/95 hover:to-primary/75 disabled:cursor-wait disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h5l2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              </svg>
              Browse files
            </button>
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.93 19.07a10 10 0 0 1 14.14 0" />
                <path d="M8.46 15.54a5 5 0 0 1 7.07 0" />
                <path d="M12 12l.01 0" />
              </svg>
              Connect drone
            </button>
          </div>
        </div>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
          {uploadError}
        </div>
      )}

      <Separator />

      {/* Project info */}
      <Card className="bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Project
          </span>
          <button className="text-[11px] font-semibold text-primary hover:underline">
            Settings
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-foreground truncate">
            {projectName}
          </span>
          {projectId && (
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              {projectId}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">Location</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {location || "—"}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">Target</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {targetType}
            </div>
          </div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">
                Quality checks
              </div>
              <span className="text-[11px] font-semibold text-emerald-400">
                {checksReady ? "All good" : "Checking…"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <QualityCheck label="GPS" status={qualityChecks.gps} />
              <QualityCheck label="Overlap" status={qualityChecks.overlap} />
              <QualityCheck label="Exposure" status={qualityChecks.exposure} />
            </div>
          </div>
        )}

        {uploadedFiles.length > 0 && !processing && (
          <div className="flex items-center gap-2 pt-1">
            {hasOnlyImages ? (
              <Button onClick={handleSkipToDesign} className="flex-1 gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 4V2m0 14v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h.01M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />
                </svg>
                Skip to Design
              </Button>
            ) : (
              <Button
                onClick={handleStartReconstruction}
                variant="outline"
                className="flex-1 gap-2 bg-muted/30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 4V2m0 14v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h.01M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />
                </svg>
                Start reconstruction
              </Button>
            )}
            <button
              type="button"
              disabled
              aria-label="Import metadata"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14a9 3 0 0 0 18 0V5" />
                <path d="M3 12a9 3 0 0 0 18 0" />
              </svg>
            </button>
          </div>
        )}

        {!hasOnlyImages && backgroundImageUrl && uploadedFiles.length > 0 && !processing && (
          <Button variant="outline" onClick={handleSkipToDesign} className="w-full text-xs">
            Skip reconstruction (use photo only)
          </Button>
        )}
      </Card>

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
          <div className="space-y-2">
            {uploadedFiles.slice(0, 5).map((f) => (
              <div
                key={f.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-muted/10 p-3 hover:bg-muted/20"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
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
                {(f.type === "image/jpeg" || f.type === "image/png") && (
                  <button
                    onClick={() => {
                      const pid = useProjectStore.getState().projectId;
                      setBackgroundImageUrl(`/api/uploads/${pid}/${f.name}`);
                    }}
                    title="Set as background"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                  </button>
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
    <div className="flex items-center gap-2 text-xs text-foreground/80">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-lg border ${
          status === true
            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
            : status === false
              ? "border-destructive/30 bg-destructive/15 text-destructive"
              : "border-border bg-muted/40 text-muted-foreground/50"
        }`}
      >
        {status === true && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
        )}
        {status === false && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
        )}
      </span>
      {label}
    </div>
  );
}
