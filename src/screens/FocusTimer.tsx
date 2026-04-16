import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const BG = "#0d0d0f";
const ACCENT = "#60a5fa";

type PresetKey = "focus" | "quick" | "break";

const PRESETS: { key: PresetKey; label: string; minutes: number }[] = [
  { key: "focus", label: "Focus", minutes: 25 },
  { key: "quick", label: "Quick", minutes: 10 },
  { key: "break", label: "Break", minutes: 5 },
];

type TimerStatus = "idle" | "running" | "paused";

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function playFinishSound(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.36);
    void ctx.resume();
  } catch {
    // ignore if audio blocked
  }
}

function localDayBounds(): { start: Date; nextDay: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);
  return { start, nextDay };
}

type Props = {
  session: Session;
  isPremium: boolean;
};

export function FocusTimer({ session, isPremium }: Props) {
  const [preset, setPreset] = useState<PresetKey>("focus");
  const totalSeconds = useMemo(() => {
    const p = PRESETS.find((x) => x.key === preset)!;
    return p.minutes * 60;
  }, [preset]);

  const [remaining, setRemaining] = useState(totalSeconds);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [focusCountToday, setFocusCountToday] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [showCongrats, setShowCongrats] = useState(false);

  const tickRef = useRef<number | null>(null);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  const applyPreset = useCallback((key: PresetKey) => {
    if (!isPremium && key !== "focus") return;
    setPreset(key);
    const mins = PRESETS.find((p) => p.key === key)!.minutes;
    setRemaining(mins * 60);
    setStatus("idle");
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, [isPremium]);

  const loadFocusCount = useCallback(async () => {
    setLoadErr(null);
    const { start, nextDay } = localDayBounds();
    const { count, error } = await supabase
      .from("focus_session_completions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("preset", "focus")
      .gte("completed_at", start.toISOString())
      .lt("completed_at", nextDay.toISOString());

    if (error) {
      setLoadErr(error.message);
      setFocusCountToday(null);
    } else {
      setFocusCountToday(count ?? 0);
    }
  }, [session.user.id]);

  useEffect(() => {
    void loadFocusCount();
  }, [loadFocusCount]);

  const recordCompletion = useCallback(async () => {
    const { error } = await supabase.from("focus_session_completions").insert({
      user_id: session.user.id,
      preset,
      duration_seconds: totalSeconds,
    });
    if (error) setLoadErr(error.message);
    void loadFocusCount();
  }, [loadFocusCount, preset, session.user.id, totalSeconds]);

  useEffect(() => {
    if (status !== "running") {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    tickRef.current = window.setInterval(() => {
      const next = remainingRef.current - 1;
      if (next <= 0) {
        if (tickRef.current) {
          window.clearInterval(tickRef.current);
          tickRef.current = null;
        }
        setRemaining(0);
        setStatus("idle");
        playFinishSound();
        setShowCongrats(true);
        void recordCompletion();
        return;
      }
      setRemaining(next);
    }, 1000);

    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [status, recordCompletion]);

  function start() {
    setShowCongrats(false);
    if (remaining <= 0) setRemaining(totalSeconds);
    setStatus("running");
  }

  function pause() {
    setStatus("paused");
  }

  function reset() {
    setShowCongrats(false);
    setStatus("idle");
    setRemaining(totalSeconds);
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const size = 280;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - progress);

  return (
    <div
      style={{
        minHeight: "100%",
        background: BG,
        color: "#e5e7eb",
        padding: "24px 18px 32px",
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>
          Focus Timer
        </h1>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
          Focus sessions completed today:{" "}
          <span style={{ color: ACCENT, fontWeight: 800 }}>
            {focusCountToday === null ? "—" : focusCountToday}
          </span>
        </p>
        {loadErr ? (
          <p style={{ margin: "8px 0 0", color: "#fecaca", fontSize: 13 }}>
            {loadErr}
          </p>
        ) : null}
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          marginBottom: 28,
        }}
      >
        {PRESETS.filter((p) => (isPremium ? true : p.key === "focus")).map((p) => {
          const active = preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              style={presetBtn(active)}
            >
              {p.minutes} min · {p.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#1f2937"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={ACCENT}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.35s linear" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatMmSs(remaining)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {status !== "running" ? (
            <button type="button" onClick={start} style={accentBtn}>
              Start
            </button>
          ) : (
            <button type="button" onClick={pause} style={secondaryBtn}>
              Pause
            </button>
          )}
          <button type="button" onClick={reset} style={secondaryBtn}>
            Reset
          </button>
        </div>
      </div>

      {showCongrats ? (
        <div
          role="status"
          style={{
            marginTop: 20,
            padding: "14px 16px",
            borderRadius: 12,
            border: `1px solid ${ACCENT}`,
            background: "#111827",
            color: "#e5e7eb",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          Congratulations — session complete!
          <button
            type="button"
            onClick={() => setShowCongrats(false)}
            style={{
              display: "block",
              margin: "10px auto 0",
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #374151",
              background: BG,
              color: "#e5e7eb",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <p
        style={{
          margin: "28px 0 0",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #1f2937",
          background: "#111114",
          color: "#9ca3af",
          fontSize: 14,
          lineHeight: 1.5,
          textAlign: "center",
        }}
      >
        Tip: put your phone face down while the timer runs.
      </p>
    </div>
  );
}

function presetBtn(active: boolean): CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: active ? `1px solid ${ACCENT}` : "1px solid #374151",
    background: active ? "#111827" : "#111114",
    color: active ? ACCENT : "#e5e7eb",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  };
}

const accentBtn: CSSProperties = {
  padding: "12px 20px",
  borderRadius: 10,
  border: `1px solid ${ACCENT}`,
  background: ACCENT,
  color: "#0d0d0f",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 15,
};

const secondaryBtn: CSSProperties = {
  padding: "12px 20px",
  borderRadius: 10,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "#e5e7eb",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 15,
};
