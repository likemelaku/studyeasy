import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { AssignmentTracker } from "./screens/AssignmentTracker";
import { FocusTimer } from "./screens/FocusTimer";
import { StudyHelper } from "./screens/StudyHelper";
import { StressCheckin } from "./screens/StressCheckin";
import { SettingsScreen } from "./screens/SettingsScreen";
import { PaywallScreen } from "./screens/PaywallScreen";
import { useSubscriptionGate } from "./hooks/useSubscriptionGate";
import { markChosenFree } from "./lib/subscriptionAccess";

type MainTab = "assignments" | "focus" | "study" | "stress" | "settings";

export default function App() {
  const [tab, setTab] = useState<MainTab>("assignments");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { gate: subscriptionGate, refresh: refreshSubscription } =
    useSubscriptionGate(session);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signUp() {
    setAuthError(null);
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setAuthError(error.message);
  }

  async function signIn() {
    setAuthError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setAuthError(error.message);
  }

  async function signOut() {
    setAuthError(null);
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) setAuthError(error.message);
  }

  if (session) {
    if (subscriptionGate === "loading") {
      return (
        <div
          style={{
            minHeight: "100%",
            background: "#0d0d0f",
            color: "#9ca3af",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          Loading…
        </div>
      );
    }

    const isPremium = subscriptionGate === "premium";

    if (subscriptionGate === "paywall") {
      return (
        <div style={{ minHeight: "100%", background: "#0d0d0f" }}>
          <PaywallScreen
            appUserId={session.user.id}
            userEmail={session.user.email ?? undefined}
            onUnlocked={() => void refreshSubscription()}
            onContinueFree={() => {
              markChosenFree(session.user.id);
              void refreshSubscription();
            }}
          />
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100%", background: "#0d0d0f" }}>
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "12px 18px 0",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setTab("assignments")}
              style={navBtn(tab === "assignments")}
            >
              Assignments
            </button>
            <button
              type="button"
              onClick={() => setTab("focus")}
              style={navBtn(tab === "focus")}
            >
              Focus Timer
            </button>
            <button
              type="button"
              onClick={() => setTab("stress")}
              style={navBtn(tab === "stress")}
            >
              Stress Check-in
            </button>
            <button
              type="button"
              onClick={() => setTab("settings")}
              style={navBtn(tab === "settings")}
            >
              Settings
            </button>
            {isPremium ? (
              <button
                type="button"
                onClick={() => setTab("study")}
                style={navBtn(tab === "study")}
              >
                Study Helper
              </button>
            ) : null}
          </div>
          <div style={{ color: isPremium ? "#60a5fa" : "#9ca3af", fontSize: 12, fontWeight: 700 }}>
            {isPremium ? "Premium" : "Free"}
          </div>
        </div>
        {tab === "assignments" ? (
          <AssignmentTracker session={session} isPremium={isPremium} />
        ) : tab === "focus" ? (
          <FocusTimer session={session} isPremium={isPremium} />
        ) : tab === "settings" ? (
          <SettingsScreen
            session={session}
            isPremium={isPremium}
            onLogout={signOut}
            onRestoreSuccess={refreshSubscription}
          />
        ) : tab === "study" && isPremium ? (
          <StudyHelper />
        ) : (
          <StressCheckin session={session} isPremium={isPremium} />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#0d0d0f",
        color: "#e5e7eb",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          border: "1px solid #1f2937",
          background: "#111114",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 20 }}>StudyEase</h1>
        <p style={{ margin: "0 0 14px", color: "#9ca3af", fontSize: 14 }}>
          Sign in to use assignments and the focus timer.
        </p>

        <form
          style={{ display: "grid", gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            void signIn();
          }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              style={{
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#0d0d0f",
                color: "#e5e7eb",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#0d0d0f",
                color: "#e5e7eb",
              }}
            />
          </label>

          {authError ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #7f1d1d",
                background: "#1f0b0b",
                color: "#fecaca",
                fontSize: 13,
              }}
            >
              {authError}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#1f2937",
                color: "#e5e7eb",
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => void signUp()}
              disabled={busy}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#0d0d0f",
                color: "#e5e7eb",
                cursor: busy ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ACCENT = "#60a5fa";

function navBtn(active: boolean): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: active ? `1px solid ${ACCENT}` : "1px solid #374151",
    background: active ? "#111827" : "#111114",
    color: active ? ACCENT : "#e5e7eb",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  };
}
