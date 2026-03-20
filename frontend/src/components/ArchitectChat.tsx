import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "../store/projectStore";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ArchitectChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const setBuildingSpec = useProjectStore((s) => s.setBuildingSpec);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start the conversation on mount
  useEffect(() => {
    sendMessages([
      { role: "user", content: "Hi, I'd like to design a building." },
    ]);
  }, []);

  async function sendMessages(msgs: Message[]) {
    setLoading(true);
    try {
      const res = await fetch("/api/architect/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "current", messages: msgs }),
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
    } catch {
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
  }

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

  // Skip the initial "Hi" message in the display
  const displayMessages = messages.slice(1);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}
    >
      <h3 style={{ fontSize: 14, color: "#999", margin: 0 }}>
        Architect AI
      </h3>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 0,
        }}
      >
        {displayMessages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "#2a4a7f" : "#1a1a2e",
              padding: "8px 12px",
              borderRadius: 8,
              maxWidth: "90%",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ color: "#666", fontSize: 13, fontStyle: "italic" }}>
            Thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your vision..."
          disabled={loading}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "#111",
            border: "1px solid #333",
            borderRadius: 6,
            color: "#eee",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "8px 16px",
            background: "#4a90d9",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            cursor: loading ? "wait" : "pointer",
            fontSize: 13,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
