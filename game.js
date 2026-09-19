import { PROMPTS as HAND } from './prompts.js';
import { NORMS_PROMPTS } from './norms-prompts.js';
import { passesGate, loadLexicon, inLexicon, isTypoOf, resolveAlias } from './prompt-schema.js';

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

  /* A chore is an ACTIVITY. Players reliably answer with the tool instead —
   * "wisk", "mop", "broom" — which is the wrong part of speech for the
   * category, not an obscure chore. */
  'Name a household chore': ['whisk', 'wisk', 'mop', 'broom', 'vacuum', 'sponge',
    'bucket', 'soap', 'detergent', 'bleach', 'duster', 'rag', 'towel', 'iron',
    'hoover', 'cloth', 'brush', 'kitchen', 'bathroom', 'house', 'clean', 'tidy'],

  "Name a palindrome that's a real English dictionary word": ['palindrome'],
};

/* US/UK spelling and vocabulary aliases, per prompt.
 *
 * The norms bank is generated from UK and (older) US studies, so a modern US
 * player routinely types the other country's word and scores nothing for a
 * correct answer: "drywall" is listed only as "plasterboard", "eggplant" only
 * as "aubergine". An alias resolves to the listed answer and scores exactly
 * what it scores.
 *
 * Kept here because norms-prompts.js is generated and would lose hand edits. */
const ALIASES = {
  'Name a building material': {
    drywall: 'plasterboard', sheetrock: 'plasterboard',
    aluminum: 'aluminium',
    // "rebar" was here mapped to "steel beams" — dropped. It is not actually the
    // same thing (rebar is reinforcing bar, not a beam), and it matched "bars"
    // by fragment before the alias resolved, so it scored 15 instead of 85.
  },
  'Name a vegetable': { eggplant: 'aubergine', zucchini: 'courgette', arugula: 'rocket' },
  'Name a fruit': { rockmelon: 'cantaloupe' },
  'Name a kitchen appliance': { stove: 'cooker', hob: 'cooker' },
  'Name a type of boat or ship': { rowboat: 'rowing boat' },
  'Name a car part': { hood: 'bonnet', trunk: 'boot', windshield: 'windscreen' },
  'Name a tool': { wrench: 'spanner', flashlight: 'torch' },
};

/* TWO RULES for adding to ALIASES, both learned by getting them wrong.
 *
 * 1. Never alias a word that is ALREADY a listed answer. "pants" and "sweater"
 *    are both listed for clothing, so aliasing them to "trousers"/"jumper"
 *    overwrote their own correct, shallower tiers. ENFORCED by the merge filter
 *    below — a violation is silently dropped and the test suite reports it.
 *
 * 2. Only alias words that are genuinely the SAME answer, and check the tier you
 *    are resolving into. "sneakers" -> "trainers" is a true synonym pair, but
 *    "trainers" sits at `deep` in this UK-sourced list, so the alias would pay
 *    FOSSIL BED (85) for an everyday American word. It was dropped for that
 *    reason. A CURATION judgement, not a mechanical rule: "drywall" ->
 *    "plasterboard" is also deep and IS right to keep, because drywall is not a
 *    word a player reaches for lightly — it is simply the US name for the thing.
 *    Ask: would a typical player have earned this tier by naming this? */

/* Openness defaults, applied at merge time.
 *
 * Previously inferred inside the scorer as `cat !== 'norms'`, which is a trap
 * for future prompts: every hand-written prompt was forced CLOSED and every
 * generated one OPEN, whatever it actually was. A prompt may now declare
 * `closed` for itself; these are only the fallbacks for prompts that do not.
 *
 * The defaults still encode the real distinction — prompts.js is built on
 * finite rosters (24 Greek letters, 12 South American countries) while the
 * norms bank is everyday categories with long tails (bird, fruit, occupation)
 * — but a prompt that differs can now just say so, and the validator in
 * prompt-schema.js reports anything relying on the fallback. */
const DEFAULT_GATE = 'wordlike';

function withDefaults(p, closedByDefault) {
  const closed = typeof p.closed === 'boolean' ? p.closed : closedByDefault;
  const out = { ...p, closed };
  if (!closed && !out.gate) out.gate = DEFAULT_GATE;
  if (REJECTS[p.q]) out.reject = [...(p.reject ?? []), ...REJECTS[p.q]];
  if (ALIASES[p.q]) out.aliases = { ...(p.aliases ?? {}), ...ALIASES[p.q] };

  /* Drop any alias pointing at an answer this prompt does not list. The tables
   * above are keyed by prompt text and edited by hand, so a stale entry is a
   * real risk — and an alias resolving to nothing scores a correct answer as
   * zero, which is worse than having no alias at all. Reported by
   * `npm run check`, which validates the same rule against the source files. */
  if (out.aliases) {
    // Tier names inlined: MATCH_ORDER and normalise() are declared further down
    // and this runs at module load, so referencing them here threw
    // "Cannot access 'MATCH_ORDER' before initialization" and broke every import.
    const listed = new Set();
    for (const t of ['surface', 'tooclever', 'common', 'good', 'deep']) {
      for (const e of out[t] ?? []) listed.add(String(e).toLowerCase().trim());
    }
    out.aliases = Object.fromEntries(
      Object.entries(out.aliases).filter(([alias, canonical]) => {
        const a = String(alias).toLowerCase().trim();
        const c = String(canonical).toLowerCase().trim();
        if (!listed.has(c)) return false;   // target must exist to resolve to
        if (listed.has(a)) return false;    // rule 1: alias is its own answer
        return true;
      }),
    );
  }
  return out;
}

const PROMPTS = [
  ...NORMS_PROMPTS.map((p) => withDefaults(p, false)),
  ...HAND.filter((h) => !NORMS_PROMPTS.some((n) => n.q === h.q))
    .map((p) => withDefaults(p, true)),
];

/* Load the real-word lexicon once at module load.
 *
 * Two paths, because the data lives in two forms. In the browser we import the
 * generated lexicon.js (517 KB, built by build-lexicon.js); under Node we let
 * prompt-schema.js read prevalence.tsv directly, which is the full 61k lemmas
 * and keeps the tests honest against the real source.
 *
 * Either way it is non-fatal: with no lexicon the gates fall back to shape
 * checks and the game still runs, just slightly more permissive. */
try {
  const { LEXICON_WORDS } = await import('./lexicon.js');
  loadLexicon(LEXICON_WORDS);
} catch {
  loadLexicon();   // no generated lexicon: read prevalence.tsv, or fall back
}

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

/* An unlisted answer on an OPEN set may be a real answer we never wrote down,
 * so it pays — but it must pay LESS than the shallowest thing we measured.
 *
 * It used to pay 70, above CLAY and SHALE, and that made truncation a dominant
 * strategy: "whis" scored 70 while "whiskey" scored 10, "poly" beat "polyester"
 * 70 to 60, "red" beat "red meat". Measured across the open bank, there were
 * 5,469 cases where an unlisted FRAGMENT of a listed answer outscored the
 * answer itself. A player who learned this would stop naming things and start
 * typing four-letter stubs.
 *
 * 8 points is below TOPSOIL's 10, so naming the obvious thing always beats
 * gesturing at something we cannot check. It is still clearly above zero,
 * because an unlisted answer on an open set often IS real and should not be
 * called wrong. The reward for genuine obscurity comes from the deep tiers of
 * the curated lists, which is where the measured data lives. */
const UNVERIFIED = { pts: 8, label: 'UNCHARTED', note: 'Off our maps — we cannot check this one.' };

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

  // A guess that contains a listed entry is the MORE specific answer
  // ("double-headed eagle" contains "eagle"), so it outranks the reverse
  // case, where the guess is only a fragment of a longer entry ("double"
  // inside "double-headed eagle" — that is not an answer, just a word).
  if (guess.length >= 4 && contains(guess, e)) {
    return 500 - Math.abs(e.length - guess.length);
  }

  /* The guess is a fragment of a listed entry. The old rule required the
   * fragment to carry most of the entry's CHARACTERS (guess*2 >= entry), which
   * scored "gantt", "venn", "sankey", "pie" and "bar" as NOTHING — every one a
   * correct answer to "name a type of graph or chart". Nobody says "Venn
   * diagram" out loud when the category is already diagrams; they say "Venn".
   *
   * What actually matters is whether the fragment is the DISTINCTIVE word. In
   * "gantt chart", "bar chart", "pie chart", "venn diagram", the second word is
   * the generic category noun — it is doing no identifying work, and it is
   * usually a word from the prompt itself. So a fragment counts when it covers
   * every word of the entry except generic ones.
   *
   * The reverse case is still excluded: "double" inside "double-headed eagle"
   * is a modifier, not the head noun, and modifiers are not answers. */
  if (contains(e, guess)) {
    const entryWords = words(e);
    const guessWords = words(guess);
    if (guessWords.length >= entryWords.length) return 0;   // no fragment at all

    const remainder = entryWords.filter((w) => !guessWords.includes(w));
    // Every leftover word is generic filler -> the guess carries the meaning.
    if (remainder.length && remainder.every((w) => GENERIC_WORDS.has(w))) {
      return 180 - (e.length - guess.length);
    }
    // Otherwise fall back to the character-coverage rule, which correctly
    // rejects a lone modifier while still accepting "chow fun" in "beef chow
    // fun". Short fragments are never enough on their own.
    if (guess.length < 4) return 0;
    return guess.length * 2 >= e.length ? 200 - (e.length - guess.length) : 0;
  }
  return 0;
}

/* Category nouns that carry no identifying information: they name the KIND of
 * thing the prompt already asked for. A guess that omits one of these has still
 * named the answer — "gantt" for "gantt chart", "venn" for "venn diagram".
 *
 * Kept narrow on purpose. A word belongs here only if it is the generic head of
 * a compound answer across a whole category, never if it distinguishes one
 * answer from another. "eagle" is not here: "bald eagle" and "golden eagle" are
 * different birds, and "eagle" alone is its own answer. */
const GENERIC_WORDS = new Set([
  'chart', 'graph', 'plot', 'diagram', 'map',        // graphs and charts
  'knot', 'hitch', 'bend',                           // knots
  'paper',                                            // papers
  'strait', 'channel', 'passage',                     // straits
  'chore',                                            // chores
  'dwelling',                                         // dwellings
  'particle',                                         // subatomic particles
  'fallacy',                                          // logical fallacies
  'device',                                           // literary devices
  'gourd', 'bag', 'glass',                            // drinking vessels
]);

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

/* ------------------------------------------------------ mechanical verifiers
 *
 * Some categories are DECIDABLE: you can check membership with a rule instead
 * of a list. Where that is true it beats every heuristic in prompt-schema.js,
 * because it is not a guess at all — a palindrome either reads the same
 * backwards or it does not.
 *
 * A verifier returns true (definitely a member), false (definitely not), or
 * null (cannot tell — fall through to the normal gate). Keyed by prompt text,
 * like REJECTS, so the prompt files stay pure data.
 */
/* CAREFUL: verifiers receive the RAW input, lightly cleaned, NOT the scorer's
 * normalised form. normalise() trims a trailing "s" (so "ramens" reaches
 * "ramen"), which silently breaks any rule that depends on exact spelling:
 * "sees" became "see" and stopped being a palindrome, "laos" became "lao" and
 * stopped having four letters. Both were real listed answers scoring zero. */
const VERIFIERS = {
  "Name a palindrome that's a real English dictionary word": (raw) => {
    const w = raw.replace(/[^a-z0-9]/g, '');
    if (w.length < 3) return false;              // "a", "ab" are not answers
    if (w !== [...w].reverse().join('')) return false;   // not a palindrome
    // It IS a palindrome. Only credit it if it is also a real word, which is
    // the other half of what the prompt asks for.
    return inLexicon(w) ? true : null;
  },

  'Name a country with a four-letter English name': (raw) => {
    // Decidable on length alone for the reject direction.
    return raw.replace(/[^a-z]/g, '').length === 4 ? null : false;
  },

  /* -phobia and -ology are open categories (hundreds of real members each), so
   * closing them would reject genuine answers. But the suffix alone is not
   * enough: "lassophobia" is a made-up word with a real ending, and
   * "scientology" ends in -ology while being a religion, not a science.
   *
   * So require BOTH the suffix and that the lexicon knows the whole word. That
   * keeps real obscure answers (nomophobia, emetophobia, speleology,
   * campanology are all real lemmas) while rejecting coinages. An unknown word
   * with the right ending returns false rather than null: on these two prompts
   * the suffix makes fabrication trivially easy, so the benefit of the doubt
   * does more harm than good. */
  "Name a phobia (its formal name, like 'arachnophobia')": (raw) => {
    if (!/phobia$/.test(raw)) return false;
    return inLexicon(raw) ? true : false;
  },

  'Name a branch of science ending in -ology': (raw) => {
    if (!/ology$/.test(raw)) return false;
    // Named religions and ideologies end in -ology but are not sciences.
    if (/^(scientolog|astrolog|numerolog|theolog|mytholog)/.test(raw)) return false;
    return inLexicon(raw) ? true : false;
  },
};

/* Cleaned but NOT plural-trimmed — see the note above VERIFIERS. */
function cleanForVerify(raw) {
  return String(raw ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ');
}

function verify(prompt, raw) {
  const fn = VERIFIERS[prompt.q];
  return fn ? fn(cleanForVerify(raw)) : null;
}

/* --------------------------------------------------------------- scoring */

export function scoreAnswer(prompt, raw) {
  /* Aliases resolve before anything else, so an alias behaves in every respect
   * like the answer it stands for — same tier, same rejects, same verifier.
   * "czechia" IS "czech republic"; it must not be a second, deeper answer. */
  const guess = resolveAlias(prompt, normalise(raw));
  if (!guess) return { tier: 'none', ...TIERS.none };

  // Checked before matching: the prompt's own subject word must not sneak in
  // as a fragment of a listed entry ("cheese" inside "blue cheese").
  if (isObviouslyWrong(prompt, guess)) return { tier: 'none', ...TIERS.none };

  const verdict = verify(prompt, raw);

  // Best match wins, not first match. On a tie the SHALLOWER tier takes it —
  // see the note below on "blue".
  let bestTier = null;
  let bestScore = 0;

  /* Strictly greater, not >=. With >=, an equally-good match in a DEEPER tier
   * overwrote a shallower one, so an ambiguous fragment was paid at the best
   * tier it could reach: "blue" hit both "blue jay" (surface, 10) and "blue tit"
   * (good, 60) and was paid 60. A word that ambiguous has not earned the deeper
   * answer — if it matches equally well in two places, the shallower reading is
   * the honest one. */
  for (const tier of MATCH_ORDER) {
    const score = bestInList(prompt[tier], guess);
    if (score > bestScore) {
      bestScore = score;
      bestTier = tier;
    }
  }

  /* A verifier's NO must never override the curated lists. The lists are the
   * ground truth for what is correct; a verifier is a rule for judging what is
   * NOT listed. Getting this backwards made the -ology and phobia verifiers
   * reject 32 of their own listed answers — "speleology" and "necrophobia" are
   * real terms that simply are not in the lemma list. */
  if (verdict === false && !bestTier) return { tier: 'none', ...TIERS.none };

  if (bestTier) return { tier: bestTier, ...TIERS[bestTier] };

  /* Nothing matched exactly. Before giving up, forgive an UNAMBIGUOUS typo.
   *
   * Fuzzy matching against the whole bank is unsafe — it merges 54 pairs of
   * answers that sit in different tiers ("mebibyte"/"tebibyte",
   * "epsilon"/"upsilon"), and test-scoring.js keeps that list visible. But the
   * danger is ambiguity, not fuzziness: if exactly ONE listed answer is within
   * typo distance, there is nothing to confuse it with, and "cornia" for
   * "cornea" is plainly the eye part rather than a different answer.
   *
   * So: collect every near match across all tiers, and accept only if they all
   * point at the same answer. Two candidates means we cannot tell, and guessing
   * would hand the player a tier they did not earn — so we decline. */
  const near = [];
  for (const tier of MATCH_ORDER) {
    for (const entry of prompt[tier] ?? []) {
      const e = normalise(entry);
      if (isTypoOf(e, guess)) near.push({ tier, e });
    }
  }
  if (near.length) {
    const targets = new Set(near.map((n) => n.e));
    if (targets.size === 1) {
      const target = near[0].e;
      /* Pay the shallowest tier it appears in, and never more than typing the
       * word correctly would pay. Without that cap, "chaise loune" scored 85
       * (matching the listed "chaise") while "chaise lounge" scored 60 — so a
       * misspelling beat the correct spelling, which is the exploit this whole
       * section exists to prevent. */
      /* Pay the SHALLOWEST tier the target appears in. That is the cap: a
       * misspelling can never pay more than the correct spelling, because the
       * correct spelling reaches at least this same tier by exact match.
       * (Computed directly rather than by re-entering scoreAnswer, which
       * recursed without bound.) */
      const tier = MATCH_ORDER.find((t) =>
        (prompt[t] ?? []).some((e) => normalise(e) === target));
      if (!tier) return { tier: 'none', ...TIERS.none };
      return { tier, ...TIERS[tier], corrected: target };
    }
  }

  /* Still nothing. What that MEANS depends on the prompt.
   *
   * On a CLOSED set the list is the category: 33 Norse gods is the roster, 50
   * state capitals is all of them. An answer outside it is not an obscure gem,
   * it is wrong — so "yawn" for a Norse god scores nothing, as it should.
   *
   * On an OPEN set (fish, herb, occupation) ~31 entries cover a few percent of
   * reality, so an unlisted answer is usually a real one we never wrote down.
   * Those still pay, at UNCHARTED — real credit, but capped below a listed
   * FOSSIL BED, because an answer we cannot verify must never outscore one we
   * measured. */

  /* A verifier that says YES is proof, so it pays even on a closed set: an
   * unlisted real palindrome is a correct answer we simply did not write down. */
  if (verdict === true) return { tier: 'unverified', ...UNVERIFIED };

  if (isClosedSet(prompt)) return { tier: 'none', ...TIERS.none };

  /* Open set, unlisted answer.
   *
   * This paid UNCHARTED unconditionally, so "gorbleflax" and "hoatzin" both
   * scored 70 and mashing was a reliable 70% of maximum. The gate now requires
   * the guess to be a real word.
   *
   * That is necessary but NOT sufficient, and the limit is worth stating: the
   * gate cannot tell whether a real word belongs to the category. "pizza" is a
   * real word, so on an open prompt it still pays. The defence against that is
   * not the gate but the `closed` flag — which is why only 13 of 61 hand-written
   * prompts are open, down from 37. A category we cannot verify membership for
   * should be CLOSED, so that an unlisted answer scores nothing rather than 70.
   * REJECTS covers the predictable wrong-category answers on what remains. */
  if (!passesGate(prompt, guess)) return { tier: 'none', ...TIERS.none };
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
  // Set explicitly by withDefaults() at merge time, so by the time a prompt
  // reaches the scorer this is always a real boolean rather than an inference.
  if (typeof prompt.closed === 'boolean') return prompt.closed;
  return prompt.cat !== 'norms';   // fallback for a prompt passed in directly
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

/* ------------------------------------------------------------- day freeze
 *
 * A round can be drawn deterministically from a date, so every player gets the
 * same seven prompts on the same day — the Wordle model.
 *
 * This is not cosmetic. It is the precondition for ever tiering from player
 * submissions, because live percentile recalibration is a FEEDBACK LOOP: reward
 * an answer highly, it gets typed more, its percentile rises, it is demoted, so
 * it pays less and gets typed less again. Tiers oscillate and a player's score
 * depends on when in the day they played, which makes scores incomparable and
 * the collected data useless as norms.
 *
 * Freezing the day fixes the second half of that: within a day the prompt set
 * and its tiers are constant, so every submission for a prompt is drawn under
 * identical conditions. Recalibration then happens BETWEEN days, from the
 * accumulated log, never from the live scoring stream.
 *
 * Deterministic and offline: no server, no fetch, no clock authority beyond the
 * player's own date. A player in a different timezone gets a different day's
 * round, which is fine — rows are timestamped in UTC.
 */

/** A small, fast, well-distributed 32-bit hash. Seeds the day's shuffle. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — a tiny seeded PRNG. Same seed, same sequence, every platform. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledWith(arr, rnd) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The UTC day key, e.g. "2026-09-18". */
export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** The frozen round for a given day. Identical for every player, every call. */
export function buildDailyRound(date = new Date()) {
  const key = dayKey(date);
  const rnd = seededRandom(hashString(`strata:${key}`));
  const out = [];
  for (const p of shuffledWith(PROMPTS, rnd)) {
    if (out.length >= ROUND_LENGTH) break;
    if (clashes(p.q, out.map((x) => x.q))) continue;
    out.push(p);
  }
  return { key, prompts: out };
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

/* The MERGED bank, as the scorer actually sees it: norms and hand-written
 * prompts combined, with `closed`/`gate` defaults applied and REJECTS attached.
 *
 * Exported for the tests, which previously imported prompts.js directly and so
 * tested prompts WITHOUT their reject lists — the merge happens here, and a
 * test that skips it is not testing the real thing. */
export const ALL_PROMPTS = PROMPTS;
