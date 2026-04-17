import { cn } from "@/lib/utils";

interface Props {
  size?: number;
  className?: string;
}

/**
 * Atria wordmark + glyph. The glyph is an upward-pointing arch — the negative
 * space inside an A — rendered in amber on obsidian. Used in the navbar,
 * loading overlays, and any "brand moment" surface.
 */
export default function AtriaMark({ size = 28, className }: Props) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-md bg-[#0a0a0a]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      >
        {/* Upward arch — the A glyph */}
        <path d="M3 21 L12 4 L21 21" />
        <path d="M7.5 14 L16.5 14" />
      </svg>
    </div>
  );
}
