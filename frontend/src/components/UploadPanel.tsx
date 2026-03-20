import { useCallback, useRef } from "react";
import { useProjectStore } from "../store/projectStore";

export default function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const setFootage = useProjectStore((s) => s.setFootage);
  const footage = useProjectStore((s) => s.footage);
  const processing = useProjectStore((s) => s.processing);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setFootage(Array.from(files));
    },
    [setFootage],
  );

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*,.dng,.cr2,.arw,.nef"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={processing}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "#1a1a2e",
          border: "1px dashed #444",
          borderRadius: 8,
          color: "#ccc",
          cursor: processing ? "wait" : "pointer",
          fontSize: 14,
        }}
      >
        {processing
          ? "Processing..."
          : footage.length > 0
            ? `${footage.length} file(s) selected`
            : "Select drone footage"}
      </button>
      {footage.length > 0 && !processing && (
        <button
          onClick={() => {
            // TODO: trigger reconstruction pipeline
          }}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "12px 16px",
            background: "#4a90d9",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Reconstruct Scene
        </button>
      )}
    </div>
  );
}
