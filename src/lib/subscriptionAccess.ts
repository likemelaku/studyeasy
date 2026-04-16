const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

function trialKey(userId: string): string {
  return `studyease_trial_start_${userId}`;
}

function freeChosenKey(userId: string): string {
  return `studyease_free_chosen_${userId}`;
}

/** Records when this user’s app-side free trial began (first sign-in on this device). */
export function ensureLocalTrialStarted(userId: string): void {
  const key = trialKey(userId);
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, new Date().toISOString());
  }
}

export function isLocalTrialActive(userId: string): boolean {
  const raw = localStorage.getItem(trialKey(userId));
  if (!raw) return false;
  const start = new Date(raw).getTime();
  if (Number.isNaN(start)) return false;
  return Date.now() - start < TRIAL_MS;
}

export function hasChosenFree(userId: string): boolean {
  return localStorage.getItem(freeChosenKey(userId)) === "1";
}

export function markChosenFree(userId: string): void {
  localStorage.setItem(freeChosenKey(userId), "1");
}
