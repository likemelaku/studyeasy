import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

const BG = "#0d0d0f";
const ACCENT = "#60a5fa";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function StudyHelper() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Hey — what’s on your mind? Ask me anything about studying, deadlines, sleep, group projects, or staying focused.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setError(null);
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setSending(true);

    try {
      const firstUserIdx = history.findIndex((m) => m.role === "user");
      const apiMessages =
        firstUserIdx === -1
          ? []
          : history.slice(firstUserIdx).map((m) => ({
              role: m.role,
              content: m.content,
            }));

      const res = await fetch("/api/study-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${res.status})`;
        throw new Error(msg);
      }

      const reply =
        typeof data === "object" &&
        data !== null &&
        "text" in data &&
        typeof (data as { text: unknown }).text === "string"
          ? (data as { text: string }).text
          : "";

      if (!reply) throw new Error("Empty response from assistant.");

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: reply },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: BG,
        color: "#e5e7eb",
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        height: "min(100dvh, 900px)",
        padding: "0 18px 18px",
      }}
    >
      <header style={{ padding: "16px 0 12px", flexShrink: 0 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>
          AI Study Helper
        </h1>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
          Short, practical answers tuned for busy high school schedules.
        </p>
      </header>

      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 12,
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={
                m.role === "user" ? bubbleUser : bubbleAssistant
              }
            >
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {sending ? (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ ...bubbleAssistant, opacity: 0.85 }}>
              Thinking…
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 10,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #7f1d1d",
            background: "#1f0b0b",
            color: "#fecaca",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={onSend}
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          flexShrink: 0,
          paddingTop: 4,
          borderTop: "1px solid #1f2937",
        }}
      >
        <label style={{ flex: 1, display: "grid", gap: 6, fontSize: 13 }}>
          Your question
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. How do I start when I feel overwhelmed?"
            rows={2}
            disabled={sending}
            style={{
              resize: "vertical",
              minHeight: 52,
              maxHeight: 160,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #374151",
              background: "#111114",
              color: "#e5e7eb",
              outline: "none",
            }}
          />
        </label>
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={sendBtn}
        >
          Send
        </button>
      </form>
    </div>
  );
}

const bubbleUser: CSSProperties = {
  maxWidth: "85%",
  padding: "12px 14px",
  borderRadius: 16,
  borderBottomRightRadius: 4,
  background: ACCENT,
  color: "#0d0d0f",
  fontSize: 15,
  fontWeight: 500,
};

const bubbleAssistant: CSSProperties = {
  maxWidth: "85%",
  padding: "12px 14px",
  borderRadius: 16,
  borderBottomLeftRadius: 4,
  background: "#2a2a2e",
  color: "#e5e7eb",
  border: "1px solid #3f3f46",
  fontSize: 15,
};

const sendBtn: CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: `1px solid ${ACCENT}`,
  background: ACCENT,
  color: "#0d0d0f",
  fontWeight: 800,
  cursor: "pointer",
  marginBottom: 2,
};
