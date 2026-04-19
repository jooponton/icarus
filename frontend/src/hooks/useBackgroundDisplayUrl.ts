import { useEffect, useState } from "react";
import { apiBlobUrl } from "../lib/api";
import { useProjectStore } from "../store/projectStore";

/**
 * The store holds `/api/uploads/...` for `backgroundImageUrl` so downstream
 * code (pose estimator, mesh generator) can derive the filename. Rendering
 * that URL through CSS `background-image` would skip our auth header, so the
 * CSS layer needs a blob: URL. This hook streams one in whenever the API URL
 * changes and revokes it on cleanup.
 */
export function useBackgroundDisplayUrl(): string | null {
  const apiUrl = useProjectStore((s) => s.backgroundImageUrl);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!apiUrl) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    let created: string | null = null;
    apiBlobUrl(apiUrl)
      .then((b) => {
        if (cancelled) {
          URL.revokeObjectURL(b);
          return;
        }
        created = b;
        setBlobUrl(b);
      })
      .catch((err) => console.error("[useBackgroundDisplayUrl]", err));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [apiUrl]);

  return blobUrl;
}
