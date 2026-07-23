/**
 * ADK api_server client.
 *
 * ★ IMPORTANT (HANDOFF-replit.md §2): the repo this spec was written for has
 * an existing local demo frontend that already talks to this exact backend.
 * That reference frontend was NOT available inside this workspace when this
 * client was written, so the shapes below follow the standard/documented
 * ADK `api_server` REST contract (session CRUD + `/run`). If your local demo
 * frontend's request/response shapes differ (e.g. a different session
 * bootstrap call, or `/run_sse` instead of `/run`), adjust the two functions
 * below to match it -- everything else in the app is built against the
 * `AgentTurnResult` shape returned by `sendTurn`, not against ADK's wire
 * format directly, so the blast radius of a protocol fix is contained here.
 */
import { ADK_APP_NAME, ADK_BASE_URL } from './config';

export interface AdkPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response?: Record<string, unknown> };
}

export interface AdkEvent {
  author?: string;
  content?: { role?: string; parts?: AdkPart[] };
}

/** The structured diagnosis payload the agent reports back per turn.
 * Field names/values remain raw at the transport boundary; user-facing
 * components translate them through diagnosisCopy.ts per FRONTEND.md. */
export interface RecordCup {
  cup_no?: number;
  date?: string;
  turn_type?: string;
  terminate_reason?: string;
  gradient?: string;
  direction?: string;
  step?: string | number;
  decision?: string;
  grind_now?: string;
  confidence?: 'low' | 'medium' | 'high' | string;
  rationale?: string;
  axis?: string;
  [key: string]: unknown;
}

type RecordCupToolResponse = {
  record?: RecordCup;
};

/** Structured seed returned by start_bag. Keep these user-facing fields
 * separate from the agent's free-text explanation so the cold-start screen
 * can reliably show the frozen baseline. */
export interface SeedRecipe {
  比例?: string;
  水温?: string;
  粉量?: string;
  研磨基准?: string;
  注水手法?: string;
}

export interface StartBagResult {
  seed_recipe?: SeedRecipe;
  [key: string]: unknown;
}

export interface AgentTurnResult {
  /** Every text part the agent said this turn, in order. */
  messages: string[];
  /** The most recent record_cup-shaped functionResponse/functionCall payload
   * seen in this turn's events, if any. */
  recordCup: RecordCup | null;
  /** Structured start_bag output, present only on the cold-start turn. */
  startBag: StartBagResult | null;
  /** Full raw event list, kept for debugging / IP-sensitive screens that
   * want to inspect more than messages + recordCup. */
  rawEvents: AdkEvent[];
}

async function parseJsonOrThrow(res: Response, context: string) {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `ADK request failed (${context}): ${res.status} ${res.statusText} ${body}`.trim(),
    );
  }
  return res.json();
}

/**
 * Ensures a session exists for (userId, sessionId). Idempotent: if the
 * session already exists, ADK returns 400/409 which we swallow.
 */
export async function ensureSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const url = `${ADK_BASE_URL}/apps/${encodeURIComponent(ADK_APP_NAME)}/users/${encodeURIComponent(
    userId,
  )}/sessions/${encodeURIComponent(sessionId)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: {} }),
  });

  if (res.ok) return;
  if (res.status === 400 || res.status === 409) return; // already exists
  const body = await res.text().catch(() => '');
  throw new Error(
    `Failed to create ADK session: ${res.status} ${res.statusText} ${body}`.trim(),
  );
}

function extractRecordCup(events: AdkEvent[]): RecordCup | null {
  let persistedRecord: RecordCup | null = null;
  let toolCallArgs: RecordCup | null = null;

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const parts = events[i]?.content?.parts ?? [];
    for (const part of parts) {
      const fr = part.functionResponse;
      const fc = part.functionCall;
      if (fr && /record_cup/i.test(fr.name ?? '') && !persistedRecord) {
        const response = fr.response as RecordCupToolResponse | undefined;
        persistedRecord = response?.record ?? null;
      }
      if (fc && /record_cup/i.test(fc.name ?? '') && !toolCallArgs) {
        toolCallArgs = (fc.args as RecordCup) ?? null;
      }
    }
  }

  // Prefer the state-write result: it carries derived fields and the exact
  // cup number that the agent will see on its next turn. Tool-call arguments
  // are only a compatibility fallback for older backends.
  return persistedRecord ?? toolCallArgs;
}

function extractStartBag(events: AdkEvent[]): StartBagResult | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const parts = events[i]?.content?.parts ?? [];
    for (const part of parts) {
      const response = part.functionResponse;
      if (response && /start_bag/i.test(response.name ?? '')) {
        return (response.response as StartBagResult) ?? null;
      }
    }
  }
  return null;
}

function extractMessages(events: AdkEvent[]): string[] {
  const messages: string[] = [];
  for (const event of events) {
    for (const part of event.content?.parts ?? []) {
      if (part.text && part.text.trim().length > 0) {
        messages.push(part.text.trim());
      }
    }
  }
  return messages;
}

/**
 * Sends one natural-language user turn to the agent and returns the
 * agent's reply text(s) plus any record_cup payload emitted this turn.
 *
 * ★ Per FRONTEND.md 屏2 / HANDOFF-replit.md §6: `text` must always be a
 * natural-language sentence assembled from the user's structured form
 * choices (see `nlAssembly.ts`) -- never a raw JSON payload.
 */
export async function sendTurn(
  userId: string,
  sessionId: string,
  text: string,
): Promise<AgentTurnResult> {
  await ensureSession(userId, sessionId);

  const res = await fetch(`${ADK_BASE_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName: ADK_APP_NAME,
      userId,
      sessionId,
      newMessage: {
        role: 'user',
        parts: [{ text }],
      },
    }),
  });

  const events: AdkEvent[] = await parseJsonOrThrow(res, '/run');

  return {
    messages: extractMessages(events),
    recordCup: extractRecordCup(events),
    startBag: extractStartBag(events),
    rawEvents: events,
  };
}
