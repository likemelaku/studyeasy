import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { restorePurchaseForUser } from "../lib/revenuecatClient";

const BG = "#0d0d0f";
const ACCENT = "#60a5fa";

type Props = {
  session: Session;
  isPremium: boolean;
  onLogout: () => Promise<void>;
  onRestoreSuccess: () => Promise<void>;
};

function nameKey(userId: string): string {
  return `studyease_student_name_${userId}`;
}

export function SettingsScreen({
  session,
  isPremium,
  onLogout,
  onRestoreSuccess,
}: Props) {
  const [name, setName] = useState(() => {
    return localStorage.getItem(nameKey(session.user.id)) ?? "";
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tierLabel = useMemo(() => (isPremium ? "Premium" : "Free"), [isPremium]);

  function saveName(next: string) {
    setName(next);
    localStorage.setItem(nameKey(session.user.id), next);
  }

  async function restore() {
    setStatus(null);
    setBusy(true);
    const active = await restorePurchaseForUser(session.user.id);
    setBusy(false);
    if (active) {
      setStatus("Purchase restored. Premium unlocked.");
      await onRestoreSuccess();
    } else {
      setStatus("No active premium subscription found for this account.");
    }
  }

  async function logout() {
    setBusy(true);
    await onLogout();
    setBusy(false);
  }

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
      <h1 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800 }}>Settings</h1>
      <p style={{ margin: "0 0 18px", color: "#9ca3af", fontSize: 14 }}>
        Manage your student profile and subscription access.
      </p>

      <section style={cardStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={labelStyle}>Student name</label>
          <input
            value={name}
            onChange={(e) => saveName(e.target.value)}
            placeholder="Enter your name"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={labelStyle}>Email</label>
          <input value={session.user.email ?? ""} readOnly style={inputStyle} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={labelStyle}>Plan</label>
          <div
            style={{
              ...inputStyle,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: isPremium ? ACCENT : "#e5e7eb",
              fontWeight: 700,
            }}
          >
            <span>{tierLabel}</span>
            {isPremium ? <span>All features unlocked</span> : <span>Limited features</span>}
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: 12 }}>
        <button type="button" onClick={() => void restore()} disabled={busy} style={primaryBtn}>
          Restore Purchases
        </button>
        <button type="button" onClick={() => void logout()} disabled={busy} style={dangerBtn}>
          Logout
        </button>
      </section>

      {status ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #374151",
            background: "#111114",
            color: "#9ca3af",
            fontSize: 13,
          }}
        >
          {status}
        </div>
      ) : null}
    </div>
  );
}

const cardStyle: CSSProperties = {
  border: "1px solid #1f2937",
  background: "#111114",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 12,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  color: "#9ca3af",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid #374151",
  background: "#0d0d0f",
  color: "#e5e7eb",
};

const primaryBtn: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${ACCENT}`,
  background: ACCENT,
  color: BG,
  cursor: "pointer",
  fontWeight: 800,
};

const dangerBtn: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #7f1d1d",
  background: "#1f0b0b",
  color: "#fecaca",
  cursor: "pointer",
  fontWeight: 800,
};
