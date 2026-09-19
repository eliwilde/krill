/* submission-log.js — append-only record of what players actually typed.
 *
 * WHY THIS IS THE MOST VALUABLE FILE IN THE REPO
 *
 * Every tiering method tested so far is a PROXY for one question: when asked to
 * name a member of a category under time pressure, what do people actually say?
 *
 *   - Wikipedia pageviews: non-monotonic against curated tiers. Rejected.
 *   - Land area: non-monotonic, and wrong at the head. Rejected.
 *   - PMI co-occurrence: +0.63 against measured recall. Kept, with caveats.
 *   - Category production norms (Banks & Connell, Battig & Montague): the real
 *     thing, which is why norms-prompts.js is the trustworthy half of the bank.
 *
 * Player submissions ARE category production norms — the same instrument as
 * those studies, gathered continuously, on this exact bank, for free. Once a
 * prompt has a few thousand submissions, the guessing stops.
 *
 * So the point of this file is not analytics. It is to accumulate the dataset
 * that makes every heuristic above unnecessary.
 *
 * DESIGN RULES
 *
 * 1. NEVER block the round. Scoring and the verdict reveal must not wait on a
 *    write. Every call here is fire-and-forget and every failure is swallowed.
 * 2. Log the RAW input, before normalisation. "cornia", "wisk", "zues" and
 *    "teepee" were all bugs found from raw text; normalised input would have
 *    hidden every one of them. Typos and casing are the signal, not noise.
 * 3. Log what the scorer DECIDED, not what it should have. A row where
 *    tier=none and the answer looks correct is exactly the bug report we want.
 * 4. Append-only. Never rewrite history to match a later tier change; the
 *    whole value is knowing what the game did at the time.
 *
 * WHERE IT WRITES
 *
 * Strata deploys as static assets with no Worker script (see wrangler.toml), so
 * there is no endpoint to POST to yet. Rows therefore buffer in localStorage and
 * this module exposes an export. Set an endpoint and they drain to it instead:
 *
 *   configureLog({ endpoint: '/api/log' })
 *
 * Nothing else in the game changes when that happens.
 */

const KEY = 'strata.submissions';
const SCHEMA = 1;

/* Cap the buffer. localStorage is ~5MB and a row is ~200 bytes, so 4,000 rows
 * is well under a megabyte while being far more than one player generates.
 * Oldest rows are dropped first: with no endpoint configured this is a rolling
 * window, and the alternative (a write that throws when full) would violate
 * rule 1. */
const MAX_ROWS = 4000;

let config = {
  endpoint: null,   // POST target; null = buffer locally only
  enabled: true,
  sessionId: null,
};

/** Opt out entirely, or point rows at a collector. */
export function configureLog(next = {}) {
  config = { ...config, ...next };
  return { ...config };
}

/* A per-session id, so rows from one sitting can be grouped without anything
 * that identifies a person. Regenerated every page load, never persisted —
 * there is no cross-session tracking here and there should not be. */
function sessionId() {
  if (!config.sessionId) {
    config.sessionId = (globalThis.crypto?.randomUUID?.() ?? `s${Date.now()}${Math.random()}`)
      .slice(0, 18);
  }
  return config.sessionId;
}

function readBuffer() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];   // private mode, blocked storage, corrupt JSON — all non-fatal
  }
}

function writeBuffer(rows) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(rows.slice(-MAX_ROWS)));
  } catch {
    /* Quota exceeded or storage blocked. Dropping the row is correct: rule 1
     * says the round never suffers for logging. */
  }
}

/** The row shape. Kept flat and stable — this is a data format, not an object. */
function buildRow({ prompt, raw, result, latencyMs, promptIndex }) {
  return {
    v: SCHEMA,
    at: new Date().toISOString(),
    session: sessionId(),

    /* The UTC day, so rows can be grouped by frozen day. Recalibrating tiers
     * from submissions requires comparing like with like: a day's prompts and
     * tiers are constant, so rows sharing a `day` were collected under identical
     * conditions. Rows from a day whose tiers were mid-change are discardable. */
    day: new Date().toISOString().slice(0, 10),

    // Which prompt. The text IS the id in this bank (REJECTS, ALIASES and
    // RIVALS are all keyed by it), so it is the honest identifier.
    prompt: prompt?.q ?? null,
    closed: prompt?.closed ?? null,
    gate: prompt?.gate ?? null,
    idx: promptIndex ?? null,

    // RULE 2: exactly what was typed, untouched.
    raw: String(raw ?? ''),

    // What the scorer decided.
    tier: result?.tier ?? 'none',
    pts: result?.pts ?? 0,

    // Set when an alias or a typo correction changed the match — the two
    // mechanisms most likely to misfire, so they are recorded explicitly.
    corrected: result?.corrected ?? null,

    // Time from prompt shown to submit. A strong proxy for retrieval
    // difficulty: a fast answer was top-of-mind, a slow one was dug for. Null
    // when the timer expired with no input.
    ms: Number.isFinite(latencyMs) ? Math.round(latencyMs) : null,
  };
}

/* Fire-and-forget POST. No await, no retry, no error surface. If the collector
 * is down the row still lands in the local buffer, so nothing is lost that was
 * not already best-effort. */
function post(row) {
  if (!config.endpoint) return;
  try {
    const body = JSON.stringify(row);
    /* sendBeacon is built for exactly this: it survives page unload and cannot
     * block the main thread. fetch with keepalive is the fallback.
     *
     * TESTING NOTE: Node 22+ defines a read-only built-in `navigator` with no
     * sendBeacon, so a test that assigns `globalThis.navigator = {sendBeacon}`
     * is SILENTLY IGNORED and the beacon appears not to fire. That is the test
     * harness, not this code. Exercise the fetch branch under Node instead. */
    if (globalThis.navigator?.sendBeacon) {
      globalThis.navigator.sendBeacon(config.endpoint, body);
      return;
    }
    globalThis.fetch?.(config.endpoint, {
      method: 'POST', body, keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  } catch {
    /* Never propagates. */
  }
}

/** Record one submission. Safe to call from the hot path; never throws. */
export function logSubmission(entry) {
  if (!config.enabled) return null;
  try {
    const row = buildRow(entry);
    writeBuffer([...readBuffer(), row]);
    post(row);
    return row;
  } catch {
    return null;   // rule 1: logging failure is never the player's problem
  }
}

/* ------------------------------------------------------------------ export */

/** Everything buffered, oldest first. */
export function getSubmissions() {
  return readBuffer();
}

/** Newline-delimited JSON — the format to hand an analysis script. */
export function exportJsonl() {
  return readBuffer().map((r) => JSON.stringify(r)).join('\n');
}

/** Clear the buffer. Only call after the rows are safely somewhere else. */
export function clearSubmissions() {
  try { globalThis.localStorage?.removeItem(KEY); } catch { /* ignore */ }
}

/* Per-prompt counts of what got typed, which is the first thing worth looking
 * at: the most-typed answers should be the shallowest tiers, and where they are
 * not, the tiering is wrong. This is production norms in miniature. */
export function summarise(rows = readBuffer()) {
  const byPrompt = new Map();
  for (const r of rows) {
    if (!r.prompt) continue;
    if (!byPrompt.has(r.prompt)) byPrompt.set(r.prompt, { n: 0, answers: new Map(), zero: 0 });
    const p = byPrompt.get(r.prompt);
    p.n++;
    if (!r.pts) p.zero++;
    const key = r.raw.trim().toLowerCase();
    if (key) p.answers.set(key, (p.answers.get(key) ?? 0) + 1);
  }

  return [...byPrompt.entries()].map(([prompt, p]) => ({
    prompt,
    submissions: p.n,
    // A high zero-rate means either a hard prompt or a broken one. Worth a look
    // either way — every bug reported from play showed up as a zero here.
    zeroRate: p.n ? p.zero / p.n : 0,
    top: [...p.answers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
  })).sort((a, b) => b.submissions - a.submissions);
}
