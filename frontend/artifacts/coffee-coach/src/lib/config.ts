/**
 * ★ HARD CONSTRAINT (HANDOFF-replit.md §2): the ADK backend address must be
 * configurable, never hardcoded in components. Everything reads from these
 * two exports -- nothing else in the app should reference
 * `import.meta.env.VITE_*` directly.
 *
 * Default target is the user's own local ADK api_server. This app's cloud
 * preview cannot reach that address -- the vertical slice is only verified
 * by running `pnpm --filter @workspace/coffee-coach run dev` locally,
 * alongside a real `adk api_server` process, per HANDOFF-replit.md §3.
 */
export const ADK_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const ADK_APP_NAME: string =
  import.meta.env.VITE_ADK_APP_NAME ?? 'agents';
