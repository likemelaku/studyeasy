import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Package } from "@revenuecat/purchases-js";
import { ErrorCode, type Purchases } from "@revenuecat/purchases-js";
import {
  ensurePurchasesForUser,
  getEntitlementId,
  getRevenueCatApiKey,
} from "../lib/revenuecatClient";

const BG = "#0d0d0f";
const ACCENT = "#60a5fa";

const DISPLAY_MONTHLY = "$3.99 / month";
const DISPLAY_YEARLY = "$24.99 / year";

type Props = {
  appUserId: string;
  userEmail: string | undefined;
  onUnlocked: () => void;
  onContinueFree: () => void;
};

export function PaywallScreen({
  appUserId,
  userEmail,
  onUnlocked,
  onContinueFree,
}: Props) {
  const [purchases, setPurchases] = useState<Purchases | null>(null);
  const [monthlyPkg, setMonthlyPkg] = useState<Package | null>(null);
  const [annualPkg, setAnnualPkg] = useState<Package | null>(null);
  const [selected, setSelected] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOfferings = useCallback(async () => {
    setError(null);
    setLoading(true);
    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      setPurchases(null);
      setMonthlyPkg(null);
      setAnnualPkg(null);
      setLoading(false);
      setError(
        "Subscription checkout is not configured. Add VITE_REVENUECAT_API_KEY in your .env file."
      );
      return;
    }

    try {
      const p = await ensurePurchasesForUser(appUserId);
      if (!p) {
        setLoading(false);
        return;
      }
      setPurchases(p);
      const offerings = await p.getOfferings();
      const selectedOffering = offerings.all.default ?? offerings.current;
      setMonthlyPkg(selectedOffering?.monthly ?? null);
      setAnnualPkg(selectedOffering?.annual ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load subscription options.");
    } finally {
      setLoading(false);
    }
  }, [appUserId]);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  async function runPurchase(pkg: Package | null) {
    if (!purchases || !pkg) {
      setError("Subscription packages are not available yet. Check RevenueCat offerings.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await purchases.purchase({
        rcPackage: pkg,
        customerEmail: userEmail,
        skipSuccessPage: true,
      });
      const ok = await hasActiveSubscriptionFromInfo(result.customerInfo);
      if (ok) onUnlocked();
      else setError("Purchase completed but entitlement is not active yet. Try Restore.");
    } catch (e: unknown) {
      if (
        typeof e === "object" &&
        e !== null &&
        "errorCode" in e &&
        (e as { errorCode: number }).errorCode === ErrorCode.UserCancelledError
      ) {
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "Purchase failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function startFreeTrial() {
    const pkg = monthlyPkg;
    if (!pkg) {
      setError("Monthly plan is not available. Configure a monthly package in RevenueCat.");
      return;
    }
    await runPurchase(pkg);
  }

  async function subscribeToSelection() {
    const pkg = selected === "annual" ? annualPkg : monthlyPkg;
    if (!pkg) {
      setError(
        selected === "annual"
          ? "Yearly plan is not available. Configure an annual package in RevenueCat."
          : "Monthly plan is not available. Configure a monthly package in RevenueCat."
      );
      return;
    }
    await runPurchase(pkg);
  }

  async function restorePurchase() {
    if (!getRevenueCatApiKey()) {
      setError("RevenueCat is not configured.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const p = await ensurePurchasesForUser(appUserId);
      if (!p) {
        setError("Could not connect to RevenueCat.");
        return;
      }
      const info = await p.getCustomerInfo();
      const id = getEntitlementId();
      const active = info.entitlements.active[id];
      if (active?.isActive) {
        onUnlocked();
        return;
      }
      setError("No active subscription found for this account.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  }

  const yearlySavings = useMemo(() => {
    const monthly = 3.99;
    const annual = 24.99;
    const save = monthly * 12 - annual;
    return save > 0 ? save : 0;
  }, []);

  return (
    <div
      style={{
        minHeight: "100%",
        background: BG,
        color: "#e5e7eb",
        padding: "24px 18px 32px",
        maxWidth: 860,
        margin: "0 auto",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 22 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 800 }}>
          Choose your plan
        </h1>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 15, lineHeight: 1.5 }}>
          Keep going with Free, or upgrade to Premium to unlock everything.
        </p>
      </header>

      {loading ? (
        <p style={{ textAlign: "center", color: "#9ca3af" }}>Loading plans…</p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 16,
              alignItems: "stretch",
            }}
          >
            <div style={compareCard}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Free</div>
              <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 2 }}>
                Basic tools to stay on track
              </div>
              <ul style={featureList}>
                <li>
                  <strong>Assignments</strong>: up to 5
                </li>
                <li>
                  <strong>Focus Timer</strong>: 25 minute preset only
                </li>
                <li>
                  <strong>Stress Check-in</strong>: basic (no 7-day history)
                </li>
              </ul>
            </div>

            <div style={{ ...compareCard, border: `2px solid ${ACCENT}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: ACCENT }}>
                    Premium
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 2 }}>
                    Unlock everything + priority support
                  </div>
                </div>
                <div
                  style={{
                    alignSelf: "flex-start",
                    background: ACCENT,
                    color: BG,
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "4px 10px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  Best Value
                </div>
              </div>

              <ul style={featureList}>
                <li>
                  <strong>Assignments</strong>: unlimited
                </li>
                <li>
                  <strong>Focus Timer</strong>: 25, 10, and 5 minute presets
                </li>
                <li>
                  <strong>AI Study Helper</strong>: unlimited questions
                </li>
                <li>
                  <strong>Stress Check-in</strong>: full 7-day history
                </li>
                <li>
                  <strong>Priority support</strong>
                </li>
              </ul>

              <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setSelected("annual")}
                    style={planChoice(selected === "annual")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>Yearly</div>
                      <div style={{ fontWeight: 900, color: ACCENT }}>{DISPLAY_YEARLY}</div>
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                      Save ${yearlySavings.toFixed(2)} per year vs monthly
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelected("monthly")}
                    style={planChoice(selected === "monthly")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>Monthly</div>
                      <div style={{ fontWeight: 900, color: ACCENT }}>{DISPLAY_MONTHLY}</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void startFreeTrial()}
              style={primaryBtn}
            >
              {busy ? "Please wait…" : "Start 7 Day Free Trial"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void subscribeToSelection()}
              style={secondaryBtn}
            >
              Subscribe ({selected === "annual" ? "Yearly" : "Monthly"})
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onContinueFree}
              style={freeBtn}
            >
              Continue with Free
            </button>
          </div>
        </>
      )}

      {error ? (
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #7f1d1d",
            background: "#1f0b0b",
            color: "#fecaca",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void restorePurchase()}
        style={restoreBtn}
      >
        Restore Purchase
      </button>
    </div>
  );
}

async function hasActiveSubscriptionFromInfo(
  customerInfo: import("@revenuecat/purchases-js").CustomerInfo
): Promise<boolean> {
  const id = getEntitlementId();
  return !!customerInfo.entitlements.active[id]?.isActive;
}

const primaryBtn: CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "16px 20px",
  borderRadius: 14,
  border: `2px solid ${ACCENT}`,
  background: ACCENT,
  color: BG,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  width: "100%",
  marginTop: 0,
  padding: "16px 20px",
  borderRadius: 14,
  border: `2px solid ${ACCENT}`,
  background: "transparent",
  color: ACCENT,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

const restoreBtn: CSSProperties = {
  width: "100%",
  marginTop: 28,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #374151",
  background: "#111114",
  color: "#9ca3af",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

const freeBtn: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #374151",
  background: "#111114",
  color: "#e5e7eb",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
};

const compareCard: CSSProperties = {
  padding: "18px 16px",
  borderRadius: 16,
  border: "2px solid #374151",
  background: "#111114",
};

const featureList: CSSProperties = {
  margin: "14px 0 0",
  paddingLeft: 18,
  color: "#e5e7eb",
  display: "grid",
  gap: 10,
  fontSize: 14,
  lineHeight: 1.4,
};

function planChoice(selected: boolean): CSSProperties {
  return {
    padding: "12px 12px",
    borderRadius: 14,
    border: selected ? `2px solid ${ACCENT}` : "1px solid #374151",
    background: selected ? "#0b1220" : "#0d0d0f",
    color: "#e5e7eb",
    cursor: "pointer",
    textAlign: "left",
  };
}
