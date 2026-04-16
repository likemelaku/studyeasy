import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Purchases } from "@revenuecat/purchases-js";
import {
  ensurePurchasesForUser,
  hasActiveSubscription,
} from "../lib/revenuecatClient";
import {
  ensureLocalTrialStarted,
  hasChosenFree,
  isLocalTrialActive,
} from "../lib/subscriptionAccess";

export type SubscriptionGate = "loading" | "premium" | "paywall" | "free";

export function useSubscriptionGate(session: Session | null): {
  gate: SubscriptionGate;
  refresh: () => Promise<void>;
} {
  const [gate, setGate] = useState<SubscriptionGate>("loading");

  const refresh = useCallback(async () => {
    if (!session) {
      setGate("loading");
      return;
    }

    setGate("loading");
    ensureLocalTrialStarted(session.user.id);

    let purchases: Purchases | null = null;
    try {
      purchases = await ensurePurchasesForUser(session.user.id);
    } catch {
      purchases = null;
    }
    if (purchases) {
      try {
        if (await hasActiveSubscription(purchases)) {
          setGate("premium");
          return;
        }
      } catch {
        /* network / RC errors fall through to trial check */
      }
    }

    if (isLocalTrialActive(session.user.id)) {
      setGate("premium");
      return;
    }

    if (hasChosenFree(session.user.id)) {
      setGate("free");
      return;
    }

    setGate("paywall");
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { gate, refresh };
}
