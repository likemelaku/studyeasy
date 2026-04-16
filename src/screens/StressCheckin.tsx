import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const BG = "#0d0d0f";
const ACCENT = "#60a5fa";

export type StressLevel = "chill" | "okay" | "stressed" | "overwhelmed";

type CheckinRow = {
  id: string;
  stress_level: StressLevel;
  created_at: string;
};

const LEVELS: {
  key: StressLevel;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { key: "chill", label: "Chill", emoji: String.fromCodePoint(0x1f60c), color: "#22c55e" },
  { key: "okay", label: "Okay", emoji: String.fromCodePoint(0x1f642), color: "#60a5fa" },
  { key: "stressed", label: "Stressed", emoji: String.fromCodePoint(0x1f630), color: "#f97316" },
  {
    key: "overwhelmed",
    label: "Overwhelmed",
    emoji: String.fromCodePoint(0x1f635),
    color: "#ef4444",
  },
];

const TIPS: Record<StressLevel, string> = {
  chill: "keep it up, take a short walk to stay fresh.",
  okay: "break your assignments into one by one from most to least important.",
  stressed: "set a 25 minute focus timer and do just one task.",
  overwhelmed:
    "step away for 5 minutes, breathe, then write down everything due this week.",
};

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function last7LocalDays(): Date[] {
  const out: Date[] = [];
  const today = startOfLocalDay(new Date());
  for (let i = 6; i >= 0; i--) {
    const x = new Date(today);
    x.setDate(x.getDate() - i);
    out.push(x);
  }
  return out;
}

function levelMeta(key: StressLevel) {
  return LEVELS.find((l) => l.key === key)!;
}

type Props = {
  session: Session;
  isPremium: boolean;
};

export function StressCheckin({ session, isPremium }: Props) {
  const [lastChoice, setLastChoice] = useState<StressLevel | null>(null);
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const oldest = startOfLocalDay(new Date());
    oldest.setDate(oldest.getDate() - 6);
    oldest.setHours(0, 0, 0, 0);

    const { data, error: qErr } = await supabase
      .from("stress_checkins")
      .select("id,stress_level,created_at")
      .eq("user_id", session.user.id)
      .gte("created_at", oldest.toISOString())
      .order("created_at", { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data ?? []) as CheckinRow[]);
    }
    setLoading(false);
  }, [session.user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, StressLevel>();
    const sorted = [...rows].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    for (const r of sorted) {
      const key = localDateKey(new Date(r.created_at));
      if (!map.has(key)) map.set(key, r.stress_level);
    }
    return map;
  }, [rows]);

  const historyDays = useMemo(() => {
    return last7LocalDays().map((d) => {
      const key = localDateKey(d);
      const level = byDay.get(key) ?? null;
      return { date: d, key, level };
    });
  }, [byDay]);

  async function pick(level: StressLevel) {
    setError(null);
    setLastChoice(level);
    setSaving(true);
    const { error: insErr } = await supabase.from("stress_checkins").insert({
      user_id: session.user.id,
      stress_level: level,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    void load();
  }

  const tip = lastChoice ? TIPS[lastChoice] : null;

  return (
    <div
      style={{
        minHeight: "100%",
        background: BG,
        color: "#e5e7eb",
        padding: "24px 18px 32px",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>
          Stress Check-in
        </h1>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
          Tap how you’re feeling right now. We’ll save it so you can spot patterns
          over the week.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {LEVELS.map((lv) => (
          <button
            key={lv.key}
            type="button"
            disabled={saving}
            onClick={() => void pick(lv.key)}
            style={{
              ...emojiBtn(lv.color),
              opacity: saving ? 0.55 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            <span style={{ fontSize: 44, lineHeight: 1 }}>{lv.emoji}</span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{lv.label}</span>
          </button>
        ))}
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 14,
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

      {tip ? (
        <section
          style={{
            marginBottom: 28,
            padding: 16,
            borderRadius: 14,
            border: `1px solid ${ACCENT}`,
            background: "#111827",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: ACCENT,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 8,
            }}
          >
            Coping tip
          </div>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>
            {tip}
          </p>
        </section>
      ) : (
        <p style={{ margin: "0 0 28px", color: "#9ca3af", fontSize: 14 }}>
          Choose a mood above to see a quick tip.
        </p>
      )}

      {isPremium ? (
        <section>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 16,
            fontWeight: 800,
            color: ACCENT,
          }}
        >
          Last 7 days
        </h2>
        {loading ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Loading history…</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {historyDays.map(({ date, key, level }) => {
              const label = date.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <li
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #27272a",
                    background: "#111114",
                  }}
                >
                  <span style={{ color: "#9ca3af", fontWeight: 600 }}>{label}</span>
                  {level ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 800,
                        color: levelMeta(level).color,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{levelMeta(level).emoji}</span>
                      {levelMeta(level).label}
                    </span>
                  ) : (
                    <span style={{ color: "#52525b", fontSize: 14 }}>No check-in</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        </section>
      ) : (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #374151",
            background: "#111114",
            color: "#9ca3af",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Premium includes a 7-day stress history so you can track patterns over time.
        </div>
      )}
    </div>
  );
}

function emojiBtn(color: string): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 120,
    padding: "16px 12px",
    borderRadius: 16,
    border: `2px solid ${color}`,
    background: "#111114",
    color: "#f9fafb",
    cursor: "pointer",
    boxShadow: `0 0 0 1px ${color}22 inset`,
  };
}
