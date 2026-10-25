import { DRAFT_KEY, parseDraft, type OnboardingDraft } from "./model";

const key = (ownerId: string) => `${DRAFT_KEY}:pending:${ownerId}`;

/** Unsaved answers can recover after closing a tab, only for their verified owner. */
export function readDraftBackup(ownerId: string): OnboardingDraft | null {
  try {
    const saved = parseDraft(JSON.parse(localStorage.getItem(key(ownerId)) ?? "null"));
    return saved.ownerId === ownerId ? saved : null;
  } catch { return null; }
}

export function rememberDraftBackup(draft: OnboardingDraft) {
  if (!draft.ownerId) return;
  try { localStorage.setItem(key(draft.ownerId), JSON.stringify(draft)); } catch { /* Network saving still works when storage is unavailable. */ }
}

export function clearDraftBackup(draft: OnboardingDraft) {
  if (!draft.ownerId) return;
  try {
    if (localStorage.getItem(key(draft.ownerId)) === JSON.stringify(draft)) localStorage.removeItem(key(draft.ownerId));
  } catch { /* A newer pending answer must never be removed by an older save. */ }
}
