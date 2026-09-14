import { PROMPTS } from './prompts.js';

/* ---------------------------------------------------------------- config */

const ROUND_LENGTH = 7;
const SECONDS = 25;
const M_PER_POINT = 10;        // 700 pts = 7000m = bedrock
const BEDROCK = ROUND_LENGTH * 100 * M_PER_POINT;

/* Tiers, shallowest to deepest. Order matters: matching walks this list. */
export const TIERS = {
  none:      { pts: 0,   label: 'NOTHING',      note: 'The shovel never moved.' },
  surface:   { pts: 10,  label: 'TOPSOIL',      note: 'The answer everyone blurts out.' },
  tooclever: { pts: 15,  label: 'TOO CLEVER',   note: "You felt smart. So did thousands of others." },
  common:    { pts: 30,  label: 'CLAY',         note: 'Solid, well-trodden ground.' },
  good:      { pts: 60,  label: 'SHALE',        note: 'Most people never dig this far.' },
  deep:      { pts: 85,  label: 'FOSSIL BED',   note: 'Genuinely hard to reach.' },
  unlisted:  { pts: 100, label: 'BEDROCK',      note: 'Nobody else went here.' },
};

const MATCH_ORDER = ['surface', 'tooclever', 'common', 'good', 'deep'];

/* ------------------------------------------------------------- utilities */

/** Loose matching: "The Ramen", "ramens", "  RAMEN " all reach "ramen". */
function normalise(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(?:es|s)$/, '');
}

/* How well an entry matches a guess. Higher is a better match; 0 is none.
 *
 * Specificity matters more than tier order. "snow leopard" overlaps the
 * surface entry "leopard", but it is its own, deeper answer — matching it to
 * "leopard" would pay 10 instead of 15. Same for "jaguarundi" vs "jaguar" and
 * "mangosteen" vs "mango". So we score every candidate and take the closest
 * one, rather than the first tier that happens to overlap. */
function matchStrength(entry, guess) {
  const e = normalise(entry);
  if (!e || !guess) return 0;
  if (e === guess) return 1000;

  // Partial credit only for whole-word containment, so "mango" no longer
  // swallows "mangosteen" — but "chow fun" still reaches "beef chow fun".
  const words = (s) => s.split(' ').filter(Boolean);
  const contains = (hay, needle) => {
    const h = words(hay), n = words(needle);
    if (n.length > h.length) return false;
    for (let i = 0; i <= h.length - n.length; i++) {
      if (n.every((w, j) => h[i + j] === w)) return true;
    }
    return false;
  };

  if (guess.length < 4) return 0;
  if (!contains(e, guess) && !contains(guess, e)) return 0;

  // Closer in length = more specific a match.
  return 100 - Math.abs(e.length - guess.length);
}

function bestInList(list, guess) {
  if (!list) return 0;
  return list.reduce((best, entry) => Math.max(best, matchStrength(entry, guess)), 0);
}

function shuffled(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* --------------------------------------------------------------- scoring */

export function scoreAnswer(prompt, raw) {
  const guess = normalise(raw);
  if (!guess) return { tier: 'none', ...TIERS.none };

  // Best match wins, not first match. On a tie the deeper tier takes it —
  // if an answer genuinely sits in two lists, the player gets the benefit.
  let bestTier = null;
  let bestScore = 0;

  for (const tier of MATCH_ORDER) {
    const score = bestInList(prompt[tier], guess);
    if (score >= bestScore && score > 0) {
      bestScore = score;
      bestTier = tier;
    }
  }

  if (bestTier) return { tier: bestTier, ...TIERS[bestTier] };
  return { tier: 'unlisted', ...TIERS.unlisted };
}

/* ----------------------------------------------------------- round setup */

export function buildRound(seen = []) {
  const unseen = PROMPTS.filter((p) => !seen.includes(p.q));
  const pool = unseen.length >= ROUND_LENGTH ? unseen : PROMPTS;
  return shuffled(pool).slice(0, ROUND_LENGTH);
}

/* --------------------------------------------------------------- strata
 * Depth markers shown down the shaft. Each has a depth in metres and a note.
 * Written to make the descent feel like it passes through real ground. */
export const STRATA = [
  { m: 0,    text: 'surface · topsoil and roots' },
  { m: 400,  text: 'the plough line — nothing older survives above here' },
  { m: 800,  text: 'clay. wet, heavy, slow going' },
  { m: 1200, text: 'a buried field wall, dry-stacked' },
  { m: 1600, text: 'charcoal layer — something burned here' },
  { m: 2000, text: 'iron age. post holes and ash' },
  { m: 2400, text: 'bronze fragments, green with age' },
  { m: 2800, text: 'the last human thing you will find' },
  { m: 3200, text: 'sterile sand. no one has been here' },
  { m: 3600, text: 'THE FOSSIL BEDS' },
  { m: 4000, text: 'ammonites, coiled and patient' },
  { m: 4400, text: 'a seam of coal — an old forest, flattened' },
  { m: 4800, text: 'shale. it splits like pages' },
  { m: 5200, text: 'trilobites. 500 million years down' },
  { m: 5600, text: 'THE DEEP ROCK' },
  { m: 6000, text: 'granite. the crust proper' },
  { m: 6400, text: 'deeper than any mine ever dug' },
  { m: 6800, text: 'heat. the rock is warm to the touch' },
  { m: 7000, text: 'BEDROCK — a perfect dig ends here' },
];

export const CONFIG = { ROUND_LENGTH, SECONDS, M_PER_POINT, BEDROCK };
