import { PROMPTS as HAND } from './prompts.js';
import { NORMS_PROMPTS } from './norms-prompts.js';

/* The bank is two halves. prompts.js is hand-written: my judgement of what
 * people commonly answer. norms-prompts.js is generated from measured human
 * responses (see build-prompts.js). Where both cover the same ground the
 * measured version wins — it is data, not a guess. */
const PROMPTS = [
  ...NORMS_PROMPTS,
  ...HAND.filter((h) => !NORMS_PROMPTS.some((n) => n.q === h.q)),
];

/* ---------------------------------------------------------------- config */

const ROUND_LENGTH = 7;
const SECONDS = 25;

/* Depth is measured in FEET, and it scales exponentially rather than linearly.
 *
 * A linear scale can't be honest here. Real buried things are shallow — Roman
 * road at 13ft, a Clovis point at 30ft — while the bottom of the world is
 * 35,876ft down at Challenger Deep. Spread linearly, every artifact worth
 * naming would sit in the first 0.1% of the shaft and the other 99.9% would be
 * empty rock.
 *
 * So: depth(score) = A*(e^(k*score/MAX_SCORE) - 1), tuned so one topsoil
 * answer is ~3ft (a real trench) and a perfect 700 lands exactly on the
 * Challenger Deep. Each answer digs roughly twice as far as the last, which is
 * also better drama — the shaft opens slow and ends in freefall. */
const MAX_SCORE = ROUND_LENGTH * 100;
const BEDROCK = 35876;         // Challenger Deep, ft. The floor of the world.
const CURVE = 7;               // steepness; 7 puts one topsoil answer at ~3ft
const CURVE_A = BEDROCK / (Math.exp(CURVE) - 1);

/** Cumulative score -> depth in feet. */
export function depthFor(score) {
  return Math.round(CURVE_A * (Math.exp(CURVE * score / MAX_SCORE) - 1));
}

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

  // A guess that contains a listed entry is the MORE specific answer
  // ("double-headed eagle" contains "eagle"), so it outranks the reverse
  // case, where the guess is only a fragment of a longer entry ("double"
  // inside "double-headed eagle" — that is not an answer, just a word).
  if (contains(guess, e)) return 500 - Math.abs(e.length - guess.length);
  if (contains(e, guess)) {
    // Fragment of a multi-word entry only counts if it carries most of it.
    return guess.length * 2 >= e.length ? 200 - (e.length - guess.length) : 0;
  }
  return 0;
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

  // Checked before matching: the prompt's own subject word must not sneak in
  // as a fragment of a listed entry ("cheese" inside "blue cheese").
  if (isObviouslyWrong(prompt, guess)) return { tier: 'none', ...TIERS.none };

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

  /* Nothing matched. The lists cannot enumerate reality — ~31 entries against
   * answer spaces in the hundreds — so an unlisted answer is often a real one
   * we simply didn't write down ("wensleydale" for cheese). That is why
   * BEDROCK pays out, and why we still run NO dictionary check: that would
   * punish real-but-obscure answers, which is the opposite of the point.
   *
   * What we reject instead is the OBVIOUSLY WRONG answer — not "is this a
   * word?" but "is this even the right kind of thing?". "fish oil" is a fine
   * English phrase and a terrible answer to "name a cheese".
   * (Checked up front, before matching.) */
  return { tier: 'unlisted', ...TIERS.unlisted };
}

/* ------------------------------------------------------- relevance check
 * Judges whether a guess is the right KIND of thing for this prompt, using
 * the prompt's own answers as the reference for what a real answer looks
 * like. Never a dictionary: an obscure real answer we never listed must
 * still reach BEDROCK. */
function isObviouslyWrong(prompt, guess) {
  // An exact listed answer for THIS prompt is always valid, whatever its
  // shape. Short real answers exist: "io", "ares", "go", "ob", "r&b".
  for (const tier of MATCH_ORDER) {
    if (listHasWord(prompt[tier], guess)) return false;
  }

  // Malformed input: not an answer at all.
  if (guess.length < 3) return true;          // "2", "ab"
  if (/^[0-9\s]+$/.test(guess)) return true;  // pure numbers
  if (!/[aeiouy]/.test(guess)) return true;   // "zzzz", "bcdfg"

  // Explicit rejects: things players actually type that are plainly the
  // wrong category for this specific prompt.
  if (listHasWord(prompt.reject, guess)) return true;

  // Cross-reference the rest of the bank. If the guess is a listed answer to
  // a DIFFERENT prompt, it belongs to that category, not this one — "fish oil"
  // is a real answer to a vitamin prompt and a wrong one here. This catches
  // wrong-category answers we never explicitly listed as rejects, and it can
  // only ever fire on words the bank already knows, so a genuinely obscure
  // answer we never wrote down anywhere still reaches BEDROCK.
  if (belongsToAnotherPrompt(prompt, guess)) return true;

  // The prompt's own subject words are never answers to it. "Name a cheese"
  // should not accept "cheese"; "name a big cat" should not accept "cat".
  if (subjectWords(prompt.q).some((w) => normalise(w) === guess)) return true;

  return false;
}

/* Words from the prompt text itself, minus the framing verbs. */
function subjectWords(q) {
  const stop = new Set(['name', 'a', 'an', 'the', 'in', 'of', 'or', 'from',
    'with', 'type', 'kind', 'human', 'body', 'our', 'system', 'that', 'is',
    'its', 'own', 'for', 'no', 'and', 'played', 'used', 'over', 'people']);
  return normalise(q).split(' ').filter((w) => w && !stop.has(w));
}

function listHasWord(list, guess) {
  if (!list) return false;
  return list.some((entry) => normalise(entry) === guess);
}

/* Index of every listed answer in the bank -> the prompts it answers.
 * Built once, lazily, so importing this module stays cheap. */
let answerIndex = null;
function buildIndex() {
  const idx = new Map();
  for (const p of PROMPTS) {
    for (const tier of MATCH_ORDER) {
      for (const entry of p[tier] ?? []) {
        const key = normalise(entry);
        if (!key) continue;
        if (!idx.has(key)) idx.set(key, new Set());
        idx.get(key).add(p.q);
      }
    }
  }
  return idx;
}

function belongsToAnotherPrompt(prompt, guess) {
  answerIndex ??= buildIndex();
  const owners = answerIndex.get(guess);
  // Unknown to the whole bank -> could be a real obscure answer. Let it through.
  if (!owners) return false;
  // Listed under this prompt too -> it matched earlier, not our problem.
  return !owners.has(prompt.q);
}

/* --------------------------------------------------------------- reveal
 * After scoring, show what was deeper. The lists hold measured rarity data —
 * 4,700 ranked answers — and until now a player saw none of it: you were told
 * TOO CLEVER without ever learning what clever would have been, which is why
 * a second run played exactly like the first.
 *
 * Shows answers from strictly deeper tiers than the one hit, shallowest of
 * those first — the next rung up, not the most obscure thing in the bank. An
 * unreachable example teaches nothing; "you said pho, try khao soi" does. */
export function deeperExamples(prompt, tier, limit = 3) {
  // BEDROCK has nothing above it, and a rejected answer gets no lesson.
  if (tier === 'unlisted' || tier === 'none') return [];

  const from = MATCH_ORDER.indexOf(tier);
  if (from < 0) return [];

  const out = [];
  for (const deeper of MATCH_ORDER.slice(from + 1)) {
    const list = prompt[deeper] ?? [];
    if (!list.length) continue;
    // Sample rather than take the head, so the same prompt teaches something
    // new on a replay instead of always naming the same three answers.
    for (const entry of shuffled(list)) {
      if (out.length >= limit) break;
      if (!out.includes(entry)) out.push(entry);
    }
    if (out.length >= limit) break;
  }
  return out;
}

/* ----------------------------------------------------------- round setup */

export function buildRound(seen = []) {
  const unseen = PROMPTS.filter((p) => !seen.includes(p.q));
  const pool = unseen.length >= ROUND_LENGTH ? unseen : PROMPTS;
  return shuffled(pool).slice(0, ROUND_LENGTH);
}

/* --------------------------------------------------------------- strata
 * What you pass on the way down, at the depth you would really pass it.
 *
 * Every depth here is a real figure, not set dressing. Archaeological layers
 * come from excavation stratigraphy (medieval ~3ft, Roman ~13ft); the deep
 * marks are the famous ones — Mponeng, the Titanic, Kola, Challenger Deep.
 * Because the depth scale is exponential the shallow end gets real resolution,
 * so those first few feet of human debris are actually legible instead of
 * being crushed into one pixel.
 *
 *   kind: 'find'  — an artifact. Something someone left.
 *         'layer' — geology. The ground itself changing.
 *         'major' — a headline depth, drawn loud.
 *
 * `icon` is drawn as a small sprite beside the shaft at that depth. */
export const STRATA = [
  // --- the archaeology. All of it inside the first 40 feet, as in reality ---
  { ft: 0,      kind: 'major', text: 'SURFACE',                          icon: 'grass' },
  { ft: 1,      kind: 'find',  text: 'bottle caps, a coin, a lost key',  icon: 'coin' },
  { ft: 2,      kind: 'layer', text: 'topsoil — roots and worms' },
  { ft: 3,      kind: 'find',  text: 'medieval pottery sherd',           icon: 'pot' },
  { ft: 5,      kind: 'layer', text: 'the plough line. nothing older survives above' },
  { ft: 7,      kind: 'find',  text: 'a clay pipe stem, snapped',        icon: 'pipe' },
  { ft: 9,      kind: 'find',  text: 'post holes — a house stood here',  icon: 'post' },
  { ft: 13,     kind: 'find',  text: 'Roman road, still cambered',       icon: 'road' },
  { ft: 16,     kind: 'find',  text: 'charcoal layer — something burned', icon: 'char' },
  { ft: 20,     kind: 'find',  text: 'bronze fragments, green with age', icon: 'bronze' },
  { ft: 26,     kind: 'find',  text: 'a flint hand axe',                 icon: 'flint' },
  { ft: 30,     kind: 'find',  text: 'Clovis point in mammoth bone',     icon: 'bone' },
  { ft: 40,     kind: 'layer', text: 'sterile sand. no one has been here' },

  // --- below human reach: deep time -----------------------------------
  { ft: 60,     kind: 'find',  text: 'permafrost — a mammoth, intact',   icon: 'mammoth' },
  { ft: 120,    kind: 'layer', text: 'the water table' },
  { ft: 300,    kind: 'major', text: 'THE FOSSIL BEDS',                  icon: 'ammonite' },
  { ft: 500,    kind: 'find',  text: 'ammonites, coiled and patient',    icon: 'ammonite' },
  { ft: 900,    kind: 'find',  text: 'a coal seam — a forest, flattened', icon: 'coal' },
  { ft: 1600,   kind: 'layer', text: 'shale. it splits like pages' },
  { ft: 2600,   kind: 'find',  text: 'trilobites. 500 million years down', icon: 'trilobite' },
  { ft: 4000,   kind: 'layer', text: 'granite. the crust proper' },
  { ft: 6000,   kind: 'find',  text: 'a diamond pipe, kimberlite',       icon: 'diamond' },

  // --- the famous depths. Every number below is real --------------------
  { ft: 12500,  kind: 'major', text: 'THE TITANIC LIES HERE',            icon: 'wreck' },
  { ft: 12766,  kind: 'find',  text: 'Mponeng — deepest mine ever dug',  icon: 'mine' },
  { ft: 20000,  kind: 'layer', text: 'heat. the rock is warm to the touch' },
  { ft: 28000,  kind: 'layer', text: 'no light has ever reached this' },
  { ft: 35876,  kind: 'major', text: 'CHALLENGER DEEP — the floor of the world', icon: 'trench' },
];

export const CONFIG = { ROUND_LENGTH, SECONDS, BEDROCK, MAX_SCORE };
