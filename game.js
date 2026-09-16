import { PROMPTS as HAND } from './prompts.js';
import { NORMS_PROMPTS } from './norms-prompts.js';

/* The bank is two halves. prompts.js is hand-written: my judgement of what
 * people commonly answer. norms-prompts.js is generated from measured human
 * responses (see build-prompts.js). Where both cover the same ground the
 * measured version wins — it is data, not a guess. */
/* Wrong-category answers players actually type, per prompt. These are the
 * cases the closed-set rule cannot catch: the prompt is OPEN, so an unlisted
 * answer normally gets the benefit of the doubt, but these specific ones are
 * plainly the wrong kind of thing. Kept here rather than in norms-prompts.js
 * because that file is generated. */
const REJECTS = {
  'Name a major organ': ['blood', 'bone', 'muscle', 'skin', 'hair', 'nail', 'vein', 'artery', 'cell'],
  'Name a fish': ['whale', 'dolphin', 'squid', 'octopus', 'crab', 'lobster', 'shrimp', 'jellyfish', 'seal'],
  'Name a herb': ['weed', 'grass', 'tree', 'flower', 'salt', 'pepper', 'sugar'],
  'Name an insect': ['spider', 'scorpion', 'worm', 'snail', 'slug', 'centipede', 'tick', 'mite'],
  'Name a vehicle': ['road', 'wheel', 'engine', 'tyre', 'tire', 'driver', 'garage'],
  'Name an occupation': ['money', 'work', 'job', 'salary', 'office', 'unemployed'],
  'Name a branch of science': ['data', 'research', 'experiment', 'lab', 'scientist', 'theory'],
  'Name a part of speech': ['word', 'sentence', 'letter', 'grammar', 'language', 'articulation'],
  'Name a weapon': ['fist', 'hand', 'foot', 'war', 'army', 'soldier', 'violence', 'water', 'fire', 'air', 'earth'],
};

const PROMPTS = [
  ...NORMS_PROMPTS,
  ...HAND.filter((h) => !NORMS_PROMPTS.some((n) => n.q === h.q)),
].map((p) => (REJECTS[p.q] ? { ...p, reject: [...(p.reject ?? []), ...REJECTS[p.q]] } : p));

/* ---------------------------------------------------------------- config */

const ROUND_LENGTH = 7;
const SECONDS = 25;

/* How many recently-answered prompts are held back when the bank is exhausted
 * and rounds have to reuse prompts. Three rounds' worth, so a prompt you just
 * answered cannot come back for a while even though the draw is random. */
const RECENT = ROUND_LENGTH * 3;

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

/* An unlisted answer on an OPEN set is probably a real answer we never wrote
 * down, so it still pays — but not more than a listed FOSSIL BED, because we
 * cannot verify it. Paying 100 for anything unrecognised made typing "yawn"
 * the highest-scoring move in the game. */
const UNVERIFIED = { pts: 70, label: 'UNCHARTED', note: 'Off our maps. We will take your word for it.' };

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

  /* Nothing matched. What that MEANS depends on the prompt.
   *
   * On a CLOSED set the list is the category: 33 Norse gods is the roster, 50
   * state capitals is all of them. An answer outside it is not an obscure gem,
   * it is wrong — so "yawn" for a Norse god scores nothing, as it should.
   *
   * On an OPEN set (fish, herb, occupation) ~31 entries cover a few percent of
   * reality, so an unlisted answer is usually a real one we never wrote down.
   * Those still pay, at UNCHARTED — real credit, but capped below a listed
   * FOSSIL BED, because an answer we cannot verify must never outscore one we
   * measured. We still run NO dictionary check: that would punish genuine
   * obscure answers, which is the opposite of the point. */
  if (isClosedSet(prompt)) return { tier: 'none', ...TIERS.none };
  return { tier: 'unverified', ...UNVERIFIED };
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

  // Shape check. We cannot enumerate every wrong answer for 57 open prompts,
  // so instead we ask whether the guess is even SHAPED like an answer to this
  // category. Real answers are short noun phrases: "creme fraiche", "sea
  // snake", "french horn". Sentences and outbursts are not — "this questino
  // again? jesus" and "yawn boring nonsense" both die here. Measured against
  // the prompt's own entries, so a category that really does have long names
  // keeps its headroom.
  if (isWrongShape(prompt, guess)) return true;

  // NOTE: we deliberately do NOT reject a guess just because another prompt
  // lists it. Categories overlap in reality — Chad is a landlocked country AND
  // an African one, eggnog is a drink AND a dairy product, a sea snake is a
  // snake. That rule scored all three as NOTHING, punishing correct answers
  // while gibberish still paid out. Wrong-category answers are caught by the
  // prompt's own `reject` list and by the closed-set rule in scoreAnswer.

  // The prompt's own subject words are never answers to it. "Name a cheese"
  // should not accept "cheese"; "name a big cat" should not accept "cat".
  if (subjectWords(prompt.q).some((w) => normalise(w) === guess)) return true;

  return false;
}

/* Words that betray a sentence rather than an answer. A real answer is a noun
 * phrase; these are the connectives and pronouns that only appear when someone
 * is talking TO the game instead of answering it. */
const SENTENCE_WORDS = new Set(['i', 'me', 'my', 'you', 'your', 'we', 'they',
  'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'am',
  'do', 'does', 'did', 'dont', 'doesnt', 'didnt', 'not', 'no', 'idk', 'dunno',
  'what', 'why', 'how', 'when', 'who', 'again', 'question', 'questions',
  'answer', 'stupid', 'boring', 'bad', 'wtf', 'lol', 'ugh', 'meh', 'whatever',
  'fuck', 'fucking', 'shit', 'hate', 'sucks', 'know', 'think', 'guess']);

/* Does the guess fail to look like an answer to this prompt? */
function isWrongShape(prompt, guess) {
  const words = guess.split(' ').filter(Boolean);

  // Talking to the game rather than answering it.
  if (words.some((w) => SENTENCE_WORDS.has(w))) return true;

  // Longer than anything this category actually contains, with slack. Some
  // categories genuinely have long entries ("central african republic"), so
  // the bar is the prompt's own longest answer plus one word.
  const longest = MATCH_ORDER.reduce((max, tier) => {
    for (const entry of prompt[tier] ?? []) {
      const n = normalise(entry).split(' ').filter(Boolean).length;
      if (n > max) max = n;
    }
    return max;
  }, 1);
  return words.length > longest + 1;
}

/* Is this prompt's list effectively the whole category?
 *
 * A prompt may declare `closed: true/false` itself. Absent that, the measured
 * norms prompts are treated as OPEN (they are everyday categories — fish,
 * furniture, occupation — with long real tails), and the hand-written bank as
 * CLOSED, which is the rule prompts.js already documents for itself: every
 * prompt in it is a finite roster ~31 entries can actually cover. */
function isClosedSet(prompt) {
  if (typeof prompt.closed === 'boolean') return prompt.closed;
  return prompt.cat !== 'norms';
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
  // UNCHARTED sits outside the measured ladder, so it has no "deeper" either.
  if (tier === 'unlisted' || tier === 'none' || tier === 'unverified') return [];

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

/* Prompt pairs whose answer lists overlap so heavily that drawing both is a
 * bad round: you get asked for a recorder twice and it pays 15 one time and 60
 * the other, because each tier is measured against its own category. The tiers
 * are not wrong — a robin IS a common bird and an obscure bird of prey — but
 * seeing both in one sitting reads as the game contradicting itself.
 * Measured by answer-set containment; see the overlap audit in the commit. */
const RIVALS = [
  ['Name a musical instrument', 'Name a wind instrument'],
  ['Name a musical instrument', 'Name a string instrument'],
  ['Name a chemical element', 'Name a metal'],
  ['Name a bird', 'Name a bird of prey'],
  ['Name a kitchen appliance', 'Name a kitchen utensil'],
  ['Name a tool', "Name a carpenter's tool"],
];

function clashes(q, picked) {
  return RIVALS.some(([a, b]) =>
    (q === a && picked.includes(b)) || (q === b && picked.includes(a)));
}

export function buildRound(seen = []) {
  // Prefer prompts this player hasn't had. Falling straight back to the full
  // bank meant a seventh round repeated whatever it liked; instead we top up
  // with the least-recently-seen, so repeats only appear once the bank is
  // genuinely exhausted and even then in the order they'll feel freshest.
  const unseen = shuffled(PROMPTS.filter((p) => !seen.includes(p.q)));
  // Staleness picks the pool, chance picks the round out of it. Ordering the
  // stale prompts by seen.indexOf alone is completely deterministic — every
  // prompt has a distinct index, so nothing is left for a shuffle to break —
  // and a player who had exhausted the bank got the same seven prompts in the
  // same order every round forever after. Drawing from the stalest N instead
  // would keep redrawing what they just answered, since last round's prompts
  // are themselves only a round away from being stalest. So the freshest
  // RECENT prompts go to the back of the queue outright and the round is drawn
  // at random from everything older: varied every time, but never an echo.
  const recent = seen.slice(-RECENT);
  const byStaleness = PROMPTS
    .filter((p) => seen.includes(p.q))
    .sort((a, b) => seen.indexOf(a.q) - seen.indexOf(b.q));
  const stale = shuffled(byStaleness.filter((p) => !recent.includes(p.q)))
    .concat(byStaleness.filter((p) => recent.includes(p.q)));

  const out = [];
  for (const p of [...unseen, ...stale]) {
    if (out.length >= ROUND_LENGTH) break;
    if (clashes(p.q, out.map((x) => x.q))) continue;
    out.push(p);
  }
  return out;
}

/* --------------------------------------------------------------- strata
 * What you pass on the way down, at the depth you would really pass it.
 *
 * Every depth here is a real figure, not set dressing. Archaeological layers
 * come from excavation stratigraphy (medieval ~3ft, Roman ~13ft); named sites
 * sit at their published depths (Terracotta Army 23ft, Derinkuyu 280ft, Naica
 * 984ft, Krubera springtail 6,496ft, Kidd Creek water ~9,500ft, Kola plankton
 * 21,981ft); the deep marks are the famous ones — Mponeng, the Titanic,
 * Challenger Deep.
 * Because the depth scale is exponential the shallow end gets real resolution,
 * so those first few feet of human debris are actually legible instead of
 * being crushed into one pixel.
 *
 *   kind: 'find'  — an artifact. Something someone left.
 *         'layer' — geology. The ground itself changing.
 *         'major' — a headline depth, drawn loud.
 *
 * `icon`  is drawn as a sprite beside the shaft at that depth.
 * `short` is the HUD band label, for entries whose prose does not survive
 *         being cut to the width of the readout. Optional — without it the
 *         label is the clause before the first dash or full stop. */
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
  { ft: 23,     kind: 'find',  text: 'the Terracotta Army, rank on rank', icon: 'warrior' },
  { ft: 26,     kind: 'find',  text: 'a flint hand axe',                 icon: 'flint' },
  { ft: 30,     kind: 'find',  text: 'Clovis point in mammoth bone',     icon: 'bone' },
  { ft: 40,     kind: 'layer', text: 'sterile sand. no one has been here' },

  // --- still human, but only just. Real sites, real depths -------------
  { ft: 49,     kind: 'find',  text: 'Göbekli Tepe — a temple, deliberately buried', icon: 'pillar' },
  { ft: 60,     kind: 'find',  text: 'permafrost — a mammoth, intact',   icon: 'mammoth' },
  { ft: 70,     kind: 'find',  text: "Mussolini's bunker, under a trapdoor", icon: 'bunker', short: "Mussolini's bunker" },
  { ft: 223,    kind: 'find',  text: 'roots. a shepherd tree, still drinking', icon: 'root' },
  { ft: 280,    kind: 'major', text: 'DERINKUYU — a city for 20,000, eighteen floors down', icon: 'city' },

  // --- below human reach: deep time -----------------------------------
  { ft: 500,    kind: 'find',  text: 'ammonites, coiled and patient',    icon: 'ammonite' },
  { ft: 984,    kind: 'find',  text: 'Naica — selenite crystals, 37 ft long', icon: 'crystal' },
  { ft: 1600,   kind: 'layer', text: 'shale. it splits like pages' },
  { ft: 2600,   kind: 'find',  text: 'trilobites. 500 million years down', icon: 'trilobite' },
  { ft: 4000,   kind: 'layer', text: 'granite. the crust proper' },
  { ft: 6000,   kind: 'find',  text: 'a diamond pipe, kimberlite',       icon: 'diamond' },
  { ft: 6496,   kind: 'find',  text: 'a blind springtail. the deepest animal alive', icon: 'springtail' },
  { ft: 7402,   kind: 'find',  text: 'a dinosaur knucklebone, in a drill core', icon: 'coal', short: 'a dinosaur knucklebone' },
  { ft: 9500,   kind: 'find',  text: 'water sealed off for two billion years', icon: 'water', short: 'two-billion-year-old water' },

  // --- the famous depths. Every number below is real --------------------
  { ft: 12500,  kind: 'major', text: 'THE TITANIC LIES HERE',            icon: 'wreck' },
  { ft: 12766,  kind: 'find',  text: 'Mponeng — deepest mine ever dug',  icon: 'mine' },
  { ft: 13123,  kind: 'find',  text: 'bacteria eating uranium, in the dark', icon: 'microbe', short: 'bacteria eating uranium' },
  { ft: 20000,  kind: 'layer', text: 'heat. the rock is warm to the touch' },
  { ft: 21981,  kind: 'find',  text: 'Kola — plankton fossils, four miles down', icon: 'plankton' },
  { ft: 28000,  kind: 'layer', text: 'no light has ever reached this' },
  { ft: 35876,  kind: 'major', text: 'CHALLENGER DEEP — the floor of the world', icon: 'trench' },
];

export const CONFIG = { ROUND_LENGTH, SECONDS, BEDROCK, MAX_SCORE };
