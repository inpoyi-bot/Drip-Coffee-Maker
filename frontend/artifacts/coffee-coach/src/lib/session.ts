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
import type { RecordCup, SeedRecipe } from './adkClient';

const USER_ID_KEY = 'coffee-coach:user-id';
const SESSION_ID_KEY = 'coffee-coach:session-id';
const CUPS_KEY = 'coffee-coach:cups';
const SEED_KEY = 'coffee-coach:seed';
const SEED_RECIPE_KEY = 'coffee-coach:seed-recipe';
const LATEST_SENSORY_KEY = 'coffee-coach:latest-sensory';

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

/** Resets the ADK session while keeping the same persistent user id.
 * The caller clears cup history only when the user explicitly starts a new
 * bag; ordinary refreshes and reopened tabs keep the current bag's history. */
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

/**
 * Keeps the user's unmodified sensory-button choices for the current cup.
 * The agent's `record_cup.sensory` is a free-text normalization, so it is
 * deliberately not used to decide which probe options the UI may show.
 */
export function getLatestSensory(): string[] {
  const raw = localStorage.getItem(LATEST_SENSORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function setLatestSensory(sensory: string[]): void {
  localStorage.setItem(LATEST_SENSORY_KEY, JSON.stringify(sensory));
}

export function clearLatestSensory(): void {
  localStorage.removeItem(LATEST_SENSORY_KEY);
}

/** Cold-start seed recipe text returned by the agent, shown on later screens. */
export function getSeed(): string | null {
  return localStorage.getItem(SEED_KEY);
}

export function setSeed(seedText: string): void {
  localStorage.setItem(SEED_KEY, seedText);
}

export function getSeedRecipe(): SeedRecipe | null {
  const raw = localStorage.getItem(SEED_RECIPE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SeedRecipe) : null;
  } catch {
    return null;
  }
}

export function setSeedRecipe(recipe: SeedRecipe | null): void {
  if (!recipe) {
    localStorage.removeItem(SEED_RECIPE_KEY);
    return;
  }
  localStorage.setItem(SEED_RECIPE_KEY, JSON.stringify(recipe));
}
