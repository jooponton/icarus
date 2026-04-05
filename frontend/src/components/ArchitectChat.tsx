import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectStore } from "../store/projectStore";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ArchitectChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const projectId = useProjectStore((s) => s.projectId);
  const setBuildingSpec = useProjectStore((s) => s.setBuildingSpec);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessages = useCallback(async (msgs: Message[], signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/architect/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, messages: msgs }),
        signal,
      });
      const data = await res.json();
      const updated: Message[] = [
        ...msgs,
        { role: "assistant", content: data.reply },
      ];
      setMessages(updated);

      if (data.spec_complete && data.spec) {
        setBuildingSpec(data.spec);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessages([
        ...msgs,
        {
          role: "assistant",
          content: "Connection error. Is the backend running?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [projectId, setBuildingSpec]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    sendMessages(
      [{ role: "user", content: "Hi, I'd like to design a building." }],
      controller.signal,
    );
    return () => controller.abort();
  }, [projectId, sendMessages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const updated: Message[] = [
      ...messages,
      { role: "user", content: input.trim() },
    ];
    setInput("");
    setMessages(updated);
    sendMessages(updated);
  }

  const displayMessages = messages.slice(1);

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">Architect AI</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Describe your vision and I'll help define the specs
        </p>
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-2 pb-2">
          {displayMessages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[90%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-muted text-foreground"
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="self-start text-[13px] italic text-muted-foreground animate-pulse">
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your vision..."
          disabled={loading}
          className="flex-1 text-[13px]"
        />
        <Button
          type="submit"
          size="sm"
          disabled={loading || !input.trim()}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
