export default function ViewportEmptyState() {
  return (
    <div className="grain pointer-events-none absolute inset-0 overflow-hidden">
      {/* Radial backdrop — warm amber glow + soft highlight */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 420px at 60% 35%, rgba(255,255,255,0.06), transparent 58%), radial-gradient(900px 520px at 55% 70%, color-mix(in oklch, var(--primary) 9%, transparent), transparent 55%)",
        }}
      />

      {/* Perspective grid plane */}
      <div className="absolute inset-x-0 bottom-0 top-[18%] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            transform: "perspective(900px) rotateX(70deg) translateY(0)",
            transformOrigin: "50% 0%",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            animation: "grid-float 7s ease-in-out infinite alternate",
            filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.65))",
            opacity: 0.85,
          }}
        />
        {/* Edge fade to panel color */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(closest-side at 50% 60%, transparent 0%, color-mix(in oklch, var(--background) 40%, transparent) 55%, var(--background) 92%)",
          }}
        />
      </div>

      {/* Wireframe building silhouette */}
      <div className="absolute left-1/2 top-[44%] w-[520px] max-w-[85%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div
            className="absolute -inset-6 rounded-[34px]"
            style={{
              background:
                "radial-gradient(220px 130px at 50% 20%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 65%)",
            }}
          />
          <svg
            className="relative h-auto w-full"
            viewBox="0 0 620 340"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Reconstruction preview"
          >
            <path d="M80 280 L80 130 L200 70 L350 90 L540 140 L540 280 L80 280Z" stroke="rgba(231,234,240,0.20)" strokeWidth="2" />
            <path d="M80 130 L220 170 L540 140" stroke="rgba(231,234,240,0.16)" strokeWidth="2" />
            <path d="M220 170 L220 310" stroke="rgba(231,234,240,0.14)" strokeWidth="2" />
            <path d="M200 70 L200 220" stroke="rgba(231,234,240,0.14)" strokeWidth="2" />
            <path d="M350 90 L350 250" stroke="rgba(231,234,240,0.14)" strokeWidth="2" />
            <path d="M540 140 L450 210 L220 170" stroke="rgba(245,158,11,0.22)" strokeWidth="2" />
            <path d="M450 210 L450 310" stroke="rgba(245,158,11,0.18)" strokeWidth="2" />
            <path d="M120 255 L120 150 L200 110" stroke="rgba(231,234,240,0.10)" strokeWidth="2" />
            <path d="M260 270 L260 175 L350 130" stroke="rgba(231,234,240,0.10)" strokeWidth="2" />
            <path d="M420 275 L420 190 L510 160" stroke="rgba(231,234,240,0.10)" strokeWidth="2" />
            <circle cx="450" cy="210" r="6" fill="rgba(245,158,11,0.9)" />
            <circle cx="220" cy="170" r="5" fill="rgba(231,234,240,0.55)" />
            <circle cx="350" cy="90" r="5" fill="rgba(231,234,240,0.38)" />
          </svg>

          <div className="mt-4 flex items-center justify-center">
            <div className="rounded-full border border-border/80 bg-card/55 px-4 py-2 text-sm text-muted-foreground">
              Upload drone footage to begin reconstruction
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
