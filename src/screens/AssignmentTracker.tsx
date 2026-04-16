import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type Priority = "high" | "medium" | "low";

type AssignmentRow = {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  due_at: string;
  priority: Priority;
  done: boolean;
};

const BG = "#0d0d0f";
const MEDIUM_BLUE = "#60a5fa";

const priorityRank: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const priorityColor: Record<Priority, string> = {
  high: "#ef4444",
  medium: MEDIUM_BLUE,
  low: "#22c55e",
};

function sortAssignments(list: AssignmentRow[]): AssignmentRow[] {
  return [...list].sort((a, b) => {
    const pr = priorityRank[b.priority] - priorityRank[a.priority];
    if (pr !== 0) return pr;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
}

function isDueWithin24Hours(dueAtIso: string, done: boolean): boolean {
  if (done) return false;
  const due = new Date(dueAtIso).getTime();
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  return due - now <= ms24h;
}

type Props = {
  session: Session;
  isPremium: boolean;
};

export function AssignmentTracker({ session, isPremium }: Props) {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const sorted = useMemo(() => sortAssignments(rows), [rows]);
  const canAdd = isPremium || rows.length < 5;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("assignments")
      .select("id,user_id,title,subject,due_at,priority,done")
      .order("due_at", { ascending: true });

    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data ?? []) as AssignmentRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`assignments:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignments",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load, session.user.id]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    if (!title.trim() || !subject.trim() || !dueLocal) return;

    const dueAt = new Date(dueLocal);
    if (Number.isNaN(dueAt.getTime())) return;

    setError(null);
    const { error: insErr } = await supabase.from("assignments").insert({
      user_id: session.user.id,
      title: title.trim(),
      subject: subject.trim(),
      due_at: dueAt.toISOString(),
      priority,
      done: false,
    });

    if (insErr) {
      setError(insErr.message);
      return;
    }

    setTitle("");
    setSubject("");
    setDueLocal("");
    setPriority("medium");
    void load();
  }

  async function toggleDone(row: AssignmentRow) {
    setError(null);
    const { error: uErr } = await supabase
      .from("assignments")
      .update({ done: !row.done })
      .eq("id", row.id)
      .eq("user_id", session.user.id);

    if (uErr) {
      setError(uErr.message);
      return;
    }
    void load();
  }

  async function remove(row: AssignmentRow) {
    setError(null);
    const { error: dErr } = await supabase
      .from("assignments")
      .delete()
      .eq("id", row.id)
      .eq("user_id", session.user.id);

    if (dErr) {
      setError(dErr.message);
      return;
    }
    void load();
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: BG,
        color: "#e5e7eb",
        padding: "24px 18px 48px",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>
          Assignment Tracker
        </h1>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
          Signed in as{" "}
          <span style={{ color: "#e5e7eb" }}>
            {session.user.email ?? session.user.id}
          </span>
        </p>
      </header>

      <form
        onSubmit={onAdd}
        style={{
          display: "grid",
          gap: 10,
          padding: 14,
          borderRadius: 12,
          border: "1px solid #1f2937",
          background: "#111114",
          marginBottom: 18,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>New assignment</div>
        {!isPremium ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #374151",
              background: "#0d0d0f",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            Free plan: up to <strong>5 assignments</strong>. Upgrade to Premium for
            unlimited.
          </div>
        ) : null}

        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Problem set 4"
            required
            disabled={!canAdd}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Calculus"
            required
            disabled={!canAdd}
            style={inputStyle}
          />
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Due date
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              required
              disabled={!canAdd}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={!canAdd}
              style={inputStyle}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={!canAdd}
          style={{
            ...primaryBtn,
            opacity: canAdd ? 1 : 0.55,
            cursor: canAdd ? "pointer" : "not-allowed",
          }}
        >
          Add assignment
        </button>
      </form>

      {error ? (
        <div
          style={{
            marginBottom: 12,
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

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Your assignments
          </h2>
          {loading ? (
            <span style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</span>
          ) : null}
        </div>

        {sorted.length === 0 && !loading ? (
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
            No assignments yet. Add one above.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {sorted.map((a) => {
              const accent = priorityColor[a.priority];
              const urgent = isDueWithin24Hours(a.due_at, a.done);
              const dueLabel = new Date(a.due_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <li
                  key={a.id}
                  style={{
                    borderRadius: 12,
                    border: "1px solid #1f2937",
                    background: "#111114",
                    padding: 12,
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "auto 1fr auto",
                    alignItems: "start",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={a.done}
                    onChange={() => void toggleDone(a)}
                    aria-label={`Mark done: ${a.title}`}
                    style={{ marginTop: 4, width: 18, height: 18 }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          textDecoration: a.done ? "line-through" : "none",
                          color: a.done ? "#9ca3af" : "#f9fafb",
                        }}
                      >
                        {a.title}
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: `1px solid ${accent}`,
                          color: accent,
                          textTransform: "capitalize",
                        }}
                      >
                        {a.priority}
                      </span>
                      {urgent ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "#422006",
                            border: "1px solid #f59e0b",
                            color: "#fbbf24",
                          }}
                        >
                          Due soon
                        </span>
                      ) : null}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
                      {a.subject} · Due {dueLabel}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void remove(a)}
                    style={dangerBtn}
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid #374151",
  background: "#0d0d0f",
  color: "#e5e7eb",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  marginTop: 4,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "#e5e7eb",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #7f1d1d",
  background: "#1f0b0b",
  color: "#fecaca",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
  whiteSpace: "nowrap",
};
