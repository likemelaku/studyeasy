import { Purchases } from "@revenuecat/purchases-js";

const ENTITLEMENT_ID =
  import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID ?? "premium";

export function getRevenueCatApiKey(): string | undefined {
  const k = import.meta.env.VITE_REVENUECAT_API_KEY;
  return typeof k === "string" && k.length > 0 ? k : undefined;
}

export function getEntitlementId(): string {
  return ENTITLEMENT_ID;
}

/**
 * Configures or switches the shared Purchases instance for this Supabase user.
 * Returns null if no public API key is set (RevenueCat disabled).
 */
export async function ensurePurchasesForUser(
  appUserId: string
): Promise<Purchases | null> {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return null;

  if (!Purchases.isConfigured()) {
    return Purchases.configure({ apiKey, appUserId });
  }

  const p = Purchases.getSharedInstance();
  if (p.getAppUserId() !== appUserId) {
    await p.changeUser(appUserId);
  }
  return Purchases.getSharedInstance();
}

export async function hasActiveSubscription(
  purchases: Purchases
): Promise<boolean> {
  try {
    return await purchases.isEntitledTo(getEntitlementId());
  } catch {
    return false;
  }
}

export async function restorePurchaseForUser(appUserId: string): Promise<boolean> {
  const purchases = await ensurePurchasesForUser(appUserId);
  if (!purchases) return false;
  try {
    const info = await purchases.getCustomerInfo();
    const id = getEntitlementId();
    return !!info.entitlements.active[id]?.isActive;
  } catch {
    return false;
  }
}
