/**
 * Cross-session persistence for the trajectory ("我的") page.
 *
 * ★ Why this exists (FRONTEND.md 屏5): the trajectory page must carry a
 * visible "跨会话持久化标识" -- proof that "上一杯" comes from durable
 * storage, not from in-memory chat context. localStorage is the simplest
 * honest way to demonstrate that in a local-only vertical slice: closing
 * the tab and reopening it must still show the same cup history.
 *
 * This does NOT replace the ADK session (which owns the agent's own
 * conversational/diagnostic state) -- it is the frontend's own record of
 * every `record_cup` the agent has returned, used to render Cup Timeline
 * and the trajectory chart without re-deriving them from chat transcripts.
 */
import type { RecordCup } from './adkClient';

const USER_ID_KEY = 'coffee-coach:user-id';
const SESSION_ID_KEY = 'coffee-coach:session-id';
const CUPS_KEY = 'coffee-coach:cups';
const SEED_KEY = 'coffee-coach:seed';

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = randomId('user');
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = randomId('session');
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

/** Resets the ADK session (e.g. starting a new bag of beans) while keeping
 * the same persistent user id. Cup history is intentionally NOT cleared by
 * this -- the trajectory page persists across sessions by design. */
export function startNewSession(): string {
  const id = randomId('session');
  localStorage.setItem(SESSION_ID_KEY, id);
  return id;
}

export interface StoredCup extends RecordCup {
  /** Local receipt timestamp, independent of any `date` field the agent reports. */
  recordedAt: string;
}

export function getCupHistory(): StoredCup[] {
  const raw = localStorage.getItem(CUPS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendCup(cup: RecordCup): StoredCup[] {
  const history = getCupHistory();
  const withTimestamp: StoredCup = { ...cup, recordedAt: new Date().toISOString() };
  const next = [...history, withTimestamp];
  localStorage.setItem(CUPS_KEY, JSON.stringify(next));
  return next;
}

export function clearCupHistory(): void {
  localStorage.removeItem(CUPS_KEY);
}

/** Cold-start seed recipe text returned by the agent, shown on later screens. */
export function getSeed(): string | null {
  return localStorage.getItem(SEED_KEY);
}

export function setSeed(seedText: string): void {
  localStorage.setItem(SEED_KEY, seedText);
}
