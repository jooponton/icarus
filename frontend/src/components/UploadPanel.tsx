import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProjectStore } from "../store/projectStore";

export default function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const setFootage = useProjectStore((s) => s.setFootage);
  const footage = useProjectStore((s) => s.footage);
  const processing = useProjectStore((s) => s.processing);
  const completeStep = useProjectStore((s) => s.completeStep);
  const setStep = useProjectStore((s) => s.setStep);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setFootage(Array.from(files));
    },
    [setFootage],
  );

  function handleNext() {
    completeStep("upload");
    setStep("reconstruct");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Upload Footage</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Select drone video or images of your site. RAW formats supported.
        </p>
      </div>

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
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed p-8 text-sm transition-colors ${
          dragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/50"
        } ${processing ? "cursor-wait opacity-60" : "cursor-pointer"}`}
      >
        <svg
          width="28"
          height="28"
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
        <span className="text-[13px]">
          {processing
            ? "Processing..."
            : footage.length > 0
              ? `${footage.length} file(s) selected`
              : "Drop files or click to browse"}
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          MP4, MOV, DNG, CR2, ARW, NEF
        </span>
      </button>

      {footage.length > 0 && (
        <Card className="bg-muted/30 p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Selected files
          </div>
          <div className="space-y-0.5">
            {footage.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 text-xs"
              >
                <span className="truncate text-foreground/80">{f.name}</span>
                <span className="ml-2 shrink-0 text-muted-foreground">
                  {(f.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {footage.length > 0 && !processing && (
        <Button onClick={handleNext} className="w-full">
          Continue to Reconstruct
        </Button>
      )}
    </div>
  );
}
