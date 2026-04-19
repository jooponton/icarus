import { useProjectStore } from "../store/projectStore";
import ArchitectChat from "./ArchitectChat";

export default function ChatDrawer() {
  const open = useProjectStore((s) => s.chatDrawerOpen);
  const setOpen = useProjectStore((s) => s.setChatDrawerOpen);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <button
        className="fixed inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />
      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-[380px] flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            Architect
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 p-4 min-h-0">
          <ArchitectChat />
        </div>
      </div>
    </div>
  );
}
