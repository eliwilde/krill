/* STRATA — prompt schema, validation, and the correctness contract.
 *
 * WHY THIS FILE EXISTS
 *
 * Correctness ("is this answer even a real answer?") used to be spread across
 * five places in game.js: per-prompt `reject` lists, a global SENTENCE_WORDS
 * set, subjectWords(), a longest-entry shape heuristic, and isClosedSet()
 * inferring openness from `cat !== 'norms'`. Adding one prompt meant reasoning
 * about all five, and nothing checked that you had. The result was a real bug:
 * on every open prompt, "gorbleflax" scored the same 70 points as "hoatzin".
 *
 * So the rule here is: EVERY prompt declares how it should be judged, in the
 * prompt itself, and `validateBank()` refuses a prompt that hasn't. You cannot
 * add a question and silently inherit the wrong default, because there is no
 * default to inherit.
 *
 *   node prompt-schema.js        validate both banks, print a report
 *
 * THE TWO THINGS A PROMPT MUST DECLARE
 *
 * 1. `closed: true | false` — is the list the whole category?
 *
 *    true  = 24 Greek letters, 12 South American countries, 9 parts of speech.
 *            An answer outside the list is WRONG, and scores nothing.
 *    false = bird, fruit, occupation. The list covers a few percent of a long
 *            real tail, so an unlisted answer may well be real.
 *
 *    This was previously inferred from `cat !== 'norms'`, which silently
 *    mis-set every future prompt: a hand-written open prompt would be treated
 *    as closed and reject real answers, and a closed norms prompt would pay
 *    out for gibberish. It is now explicit and required.
 *
 * 2. For open prompts, a `gate` — how to tell a real unlisted answer from a
 *    made-up one. See GATES below. Closed prompts need no gate: the list IS
 *    the gate.
 *
 * WHAT THIS FILE DOES NOT DO
 *
 * It does not assign tiers. Tiering stays where it belongs: measured category
 * production norms for the generated bank (build-prompts.js) and editorial
 * judgement for the hand-written one, audited against prevalence by
 * audit-tiers.js. Frequency data answers "how common is this word", which is a
 * DIFFERENT question from "is this a correct answer" — conflating them is how
 * you end up accepting "jupiter" for "name a moon".
 */

export const TIER_NAMES = ['surface', 'tooclever', 'common', 'good', 'deep'];

/* ------------------------------------------------------------ normalisation
 *
 * One canonical normaliser, exported, so the game, the validator and any
 * future server endpoint all agree on what "the same answer" means. This used
 * to be duplicated in game.js and audit-tiers.js with a deliberate difference
 * (the audit skipped plural-trimming so "iris" did not become "iri"), which is
 * exactly the kind of drift that makes a bank hard to extend.
 *
 * Diacritic folding is new: "café" and "cafe", "jalapeño" and "jalapeno", and
 * "Gruyère" and "gruyere" must score identically. Players type on phones.
 */
export function normalise(raw, { trimPlural = true } = {}) {
  let s = String(raw ?? '')
    .normalize('NFD')                 // split accents off their base letters
    .replace(/[̀-ͯ]/g, '')  // drop the accents
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ');
  if (trimPlural) s = s.replace(/(?:es|s)$/, '');
  return s;
}

/* Levenshtein distance, capped for speed: we never care about distances past
 * 2, so we bail as soon as the best possible result exceeds the cap. */
export function editDistance(a, b, cap = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > cap) return cap + 1;   // every path from here is too far
    prev = cur;
  }
  return prev[b.length];
}

/* Typo tolerance — and a warning about where it must NOT be used.
 *
 * MEASURED FINDING: fuzzy matching is unsafe against a TIERED answer bank, and
 * this is not a tuning problem. Applied to the 6,670 listed entries, an edit
 * distance of 1 merges 54 pairs of answers that sit in DIFFERENT tiers of the
 * same prompt:
 *
 *   mebibyte (common) ~ tebibyte (good) ~ zebibyte (deep)
 *   epsilon (common) ~ upsilon (good)
 *   acrophobia (surface) ~ aerophobia (common)
 *   east germany (surface) ~ west germany (common)
 *   zoology (surface) ~ oology (deep)
 *   asterisk (common) ~ asterism (deep)
 *
 * Every one of those is a real, distinct answer worth a different score. A
 * player who correctly types the deep answer would be paid for the shallow
 * one. Tightening the budget does not fix it — these are 1 edit apart, the
 * smallest possible tolerance. The categories this game is built on (Greek
 * letters, SI prefixes, binary units, phobias) are *precisely* the categories
 * whose members are minimal pairs.
 *
 * THEREFORE: `isTypoOf` is NOT used when matching listed answers. Scoring stays
 * exact-match, which is what keeps the tiers honest. Tolerance is exposed only
 * for the gate's own use on UNLISTED words, where there is no tier to confuse
 * and the only question is "is this a real word at all".
 *
 * The thresholds below reflect the same evidence: nothing under 6 characters,
 * because that is where minimal pairs live. */
export function typoBudget(word) {
  const n = word.length;
  if (n < 6) return 0;
  if (n <= 11) return 1;
  return 2;
}

/** Is `guess` within typo distance of `entry`? Both should be normalised.
 *
 * `strict` (the default for closed sets) additionally refuses to forgive a
 * typo when the two words differ only in a digit or a trailing roman numeral —
 * "henry v"/"henry vi" and "richard ii"/"richard iii" are different answers,
 * and no edit budget should merge them. */
export function isTypoOf(entry, guess, { strict = true } = {}) {
  const budget = Math.min(typoBudget(entry), typoBudget(guess));
  if (!budget) return false;
  if (strict && differsOnlyByNumbering(entry, guess)) return false;
  return editDistance(entry, guess, budget) <= budget;
}

/* Two answers that are the same but for a number or roman numeral are separate
 * answers, however close their spelling: "henry iv" vs "henry v", "apollo 11"
 * vs "apollo 13", "richard ii" vs "richard iii". */
function differsOnlyByNumbering(a, b) {
  const strip = (s) => s.replace(/\b[ivxlcdm]+\b|\d+/g, '#').replace(/\s+/g, ' ').trim();
  const sa = strip(a), sb = strip(b);
  if (sa !== sb) return false;
  // Same skeleton — so the ONLY difference is the numbering.
  return a !== b;
}

/* ------------------------------------------------------------------ gates
 *
 * A gate decides, for an OPEN prompt, whether an unlisted guess is plausibly a
 * real member of the category. It runs only after the answer failed to match
 * any listed entry, so it never overrides measured data — it only decides what
 * happens in the long tail, where the old code just paid out 70 unconditionally.
 *
 * Gates are deliberately cheap and legible. This is not a knowledge base; it
 * is a filter that separates "an obscure bird I didn't list" from "keyboard
 * mash", and it errs toward accepting, because rejecting a real obscure answer
 * is the worse failure for this game.
 */

/* Morphological endings that reliably signal membership in a category. These
 * do real work: -idae/-inae are taxonomic, -wort/-bane are plant names, -ite
 * and -ium are minerals and elements. A guess ending in one of these is almost
 * certainly a genuine attempt at the category. */
export const SUFFIX_HINTS = {
  bird:     ['bird', 'finch', 'hawk', 'owl', 'duck', 'goose', 'wren', 'jay', 'tit', 'crow', 'gull', 'eagle', 'fowl', 'chat', 'lark'],
  fish:     ['fish', 'shark', 'ray', 'eel', 'cod', 'perch', 'trout', 'bass'],
  plant:    ['wort', 'bane', 'weed', 'moss', 'fern', 'vine', 'bush', 'tree', 'flower', 'grass', 'leaf'],
  mineral:  ['ite', 'ine', 'ium', 'stone', 'quartz', 'spar'],
  chemical: ['ium', 'ine', 'gen', 'on'],
  anatomy:  ['bone', 'muscle', 'nerve', 'artery', 'vein', 'gland', 'us', 'um'],
  language: ['ish', 'ian', 'ese', 'ic'],
  place:    ['land', 'stan', 'burg', 'ville', 'shire', 'ton', 'sea', 'bay', 'isle'],
};

/* English orthographic plausibility. A real word — however obscure — obeys
 * English phonotactics; a keyboard mash usually does not. This is the only
 * check that catches "gorbleflax" and "krongwattle" without a dictionary, and
 * it is deliberately permissive: it rejects only what could not be an English
 * word, not merely what is unusual.
 *
 * Tuned against real obscure answers that MUST pass: hoatzin, kea, jabuticaba,
 * tuatara, pseudoscorpion, smorgasbord, chiaroscuro, tsetse, qat. */
export function looksLikeEnglishWord(word) {
  const w = String(word ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (w.length < 2) return false;
  if (w.length > 24) return false;

  // Every English word has a vowel (or y doing vowel duty).
  if (!/[aeiouy]/.test(w)) return false;

  // No English word runs five consonants together. Four is already extreme
  // (angsts, lengths) and we allow it; five is a mash.
  if (/[^aeiouy]{5}/.test(w)) return false;

  // Four identical letters in a row never happens; three is already suspect
  // but appears in "brrr"-style interjections, so we stop at four.
  if (/(.)\1{3}/.test(w)) return false;

  // q is followed by u in essentially all English words. The exceptions are
  // borrowings we explicitly allow (qat, qi, niqab, burqa, qwerty).
  if (/q(?![u])/.test(w) && !/^(qat|qi|qis|qwerty)$/.test(w) && !/q[aiu]/.test(w)) return false;

  // A long word with no vowel in its first six letters is not English.
  if (w.length > 6 && !/[aeiouy]/.test(w.slice(0, 6))) return false;

  return true;
}

/* Does the guess share a morphological ending with this category's hints? */
export function matchesSuffixHint(guess, hintKey) {
  const hints = SUFFIX_HINTS[hintKey];
  if (!hints) return false;
  const g = String(guess ?? '').toLowerCase();
  return hints.some((h) => g.endsWith(h) || g.includes(h));
}

/* ------------------------------------------------- the lexicon (real words)
 *
 * Shape alone CANNOT do this job, and it is worth being precise about why:
 * "gorbleflax" and "flurgle" are perfectly well-formed English shapes. Any
 * rule strict enough to reject them also rejects "borscht", "anschluss" and
 * "weltschmerz". Measured on 41 real obscure answers vs 16 keyboard mashes,
 * the orthographic check alone let 5 of 16 mashes through.
 *
 * The fix was already in the repo: prevalence.tsv is 61,853 real English
 * lemmas (Brysbaert et al. 2019). It contains hoatzin, tuatara, kea, chough,
 * aardwolf, okapi, ptarmigan, knish and kvass — and none of the mashes.
 *
 * CRITICAL: the lexicon PROMOTES, it never REJECTS. Its gaps are real —
 * pierogi, mangosteen and jabuticaba are all missing, and they are all correct
 * answers. So a word IN the lexicon is confidently real; a word absent from it
 * falls back to the shape check rather than being thrown out. Rejecting a real
 * obscure answer is the worst failure this game has, so absence never decides.
 *
 * The lexicon is optional. If prevalence.tsv is not present (browser build,
 * fresh clone), every gate degrades to the shape check and the game still runs.
 */

let LEXICON = null;

/* Node's fs, resolved once at module load and only under Node. The browser
 * build never enters this branch, so `prevalence.tsv` is never fetched client
 * side — see the note in build.js about how the lexicon reaches the browser. */
let NODE_FS = null;
if (globalThis.process?.versions?.node && typeof globalThis.window === 'undefined') {
  try {
    const { createRequire } = await import('node:module');
    NODE_FS = createRequire(import.meta.url)('node:fs');
  } catch {
    NODE_FS = null;   // no filesystem: gates fall back to shape checks
  }
}

/** Load the lexicon once. Safe to call anywhere; failure is non-fatal.
 *
 * Three sources, in order of preference:
 *   1. `words` passed in directly — a newline-separated string or an iterable.
 *      This is how the browser supplies lexicon.js, and how a test pins an
 *      exact vocabulary.
 *   2. prevalence.tsv on disk, under Node. The full 61k lemmas.
 *   3. Nothing. Gates fall back to shape checks; the game still runs.
 */
export function loadLexicon(words) {
  if (words != null) {
    LEXICON = typeof words === 'string'
      ? new Set(words.split('\n').filter(Boolean))
      : new Set(words);
    return LEXICON;
  }
  if (LEXICON) return LEXICON;
  LEXICON = new Set();  // cache the empty result; do not retry per guess
  if (!NODE_FS) return LEXICON;
  try {
    const url = new URL('./prevalence.tsv', import.meta.url);
    LEXICON = parseLexicon(NODE_FS.readFileSync(url, 'utf8'));
  } catch {
    // Not present in this build — documented fallback, not a failure.
  }
  return LEXICON;
}

/** How many words the active lexicon holds. 0 means shape-only fallback. */
export function lexiconSize() {
  return loadLexicon().size;
}

function parseLexicon(text) {
  const out = new Set();
  const lines = String(text).split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const w = lines[i].split('\t')[0];
    if (w) out.add(w.toLowerCase().trim());
  }
  return out;
}

/** Is this a known real English lemma? Absence proves nothing. */
export function inLexicon(word) {
  const lex = loadLexicon();
  if (!lex || !lex.size) return false;
  const w = String(word ?? '').toLowerCase().trim();
  if (lex.has(w)) return true;
  // Cheap de-pluralising, matching the game's own normalise().
  if (w.endsWith('es') && lex.has(w.slice(0, -2))) return true;
  if (w.endsWith('s') && lex.has(w.slice(0, -1))) return true;
  return false;
}

/* Every word of a multi-word guess that the lexicon recognises. "snow petrel"
 * -> snow yes, petrel yes. "blargh snork" -> neither. */
function lexiconWordHits(guess) {
  const words = String(guess ?? '').toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (!words.length) return { hits: 0, total: 0 };
  return { hits: words.filter(inLexicon).length, total: words.length };
}

/* The gate registry. A prompt names one by string, so prompts.js stays pure
 * data and a prompt file never has to import a function.
 *
 *   'closed'    no gate needed; the list is the category. (Set by closed:true.)
 *   'lenient'   for categories of PROPER NOUNS and phrases a lemma list cannot
 *               contain: Pixar characters, former countries, straits, math
 *               symbols. The lexicon cannot help here ("wall-e" and "yugoslavia"
 *               are not lemmas), so this leans on shape — but it still must
 *               reject mash, so it applies the stricter clean-shape test rather
 *               than the bare one. Multi-word guesses pass on shape alone,
 *               since "strait of hormuz" is self-evidently an attempt.
 *   'wordlike'  accept if the lexicon knows it, OR (absent from the lexicon)
 *               it is orthographically plausible AND compound. The sensible
 *               default for open prompts: it catches mash while still paying
 *               out for "mangosteen" and "snow petrel".
 *   'hinted'    as wordlike, but a single unknown word must also match the
 *               category's morphological hints. Strictest open gate — use it
 *               where the category has strong endings (bird, plant, mineral).
 */
export const GATES = {
  closed: () => false,

  lenient: (guess) => {
    if (inLexicon(guess)) return true;
    if (!looksLikeEnglishWord(guess)) return false;
    const { hits, total } = lexiconWordHits(guess);
    if (total > 1 && hits >= 1) return true;   // "strait of hormuz"
    // A proper noun the lexicon cannot know ("yugoslavia", "wall-e") still has
    // to look like a word rather than a mash.
    return hasCleanWordShape(guess);
  },

  wordlike: (guess) => {
    // The lexicon is GROUND TRUTH and is checked first. Shape heuristics are
    // only ever a fallback for words it does not know. Checking shape first was
    // a real bug: "borscht" is in the lexicon, but its 5-consonant run "rscht"
    // failed the shape test before the lexicon was ever consulted.
    if (inLexicon(guess)) return true;
    if (!looksLikeEnglishWord(guess)) return false;
    const { hits, total } = lexiconWordHits(guess);
    if (total > 1 && hits >= 1) return true;              // "snow petrel"
    // Unknown single word. The lexicon has real gaps (pierogi, jabuticaba),
    // so we do not reject outright — but we require a cleaner shape than the
    // baseline, which is what separates "mangosteen" from "gorbleflax".
    return hasCleanWordShape(guess);
  },

  hinted: (guess, prompt) => {
    if (inLexicon(guess)) return true;        // ground truth first, as above
    if (!looksLikeEnglishWord(guess)) return false;
    const { hits, total } = lexiconWordHits(guess);
    if (total > 1 && hits >= 1) return true;
    return matchesSuffixHint(guess, prompt.hint ?? prompt.cat) && hasCleanWordShape(guess);
  },
};

/* A stricter shape test, used only for words the lexicon does not know.
 *
 * The signal that actually separates real borrowings from invented nonsense is
 * SYLLABLE RHYTHM. Real words alternate vowel and consonant groups fairly
 * evenly; mashes pile up long consonant runs and stack unlikely clusters.
 * "mangosteen" and "jabuticaba" pass; "gorbleflax" and "krongwattle" fail on
 * cluster count. This is a heuristic on the residual, not the main gate. */
export function hasCleanWordShape(word) {
  const w = String(word ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (w.length < 3) return false;

  // Count consonant clusters of 2+. Real English words rarely stack more than
  // two such clusters in a short word; invented ones tend to.
  const clusters = w.match(/[^aeiouy]{2,}/g) ?? [];
  const heavy = clusters.filter((c) => c.length >= 3).length;

  // A heavy cluster is normal in borrowings (borscht, anschluss, weltschmerz,
  // schnapps) — but only when it is a cluster English actually borrows. Judging
  // these on cluster COUNT alone rejected all four, so we check the clusters
  // themselves against the ones real loanwords use.
  const BORROWED = /^(sch|scht|nschl|rsch|chst|tsch|zsch|str|spr|schm|schn|schw|ngst|rtz|tzk|ksch|pf|cht)$/;
  const unexplained = clusters.filter((c) => c.length >= 3 && !BORROWED.test(c));
  if (unexplained.length > 0 && w.length < 12) return false;
  if (heavy === 0 && clusters.length >= 3 && w.length < 12) return false;

  // Vowel ratio: English sits around 35-40%. Below 25% reads as a mash.
  const vowels = (w.match(/[aeiouy]/g) ?? []).length;
  if (vowels / w.length < 0.25) return false;

  return true;
}

/* What an open prompt's gate decides, as a single call. Returns true if the
 * unlisted guess should be credited. */
export function passesGate(prompt, guess) {
  const gate = GATES[prompt.gate] ?? GATES.wordlike;
  return gate(guess, prompt);
}

/* ------------------------------------------------------------- validation
 *
 * These are the mistakes you actually make when adding a prompt. Each one was
 * either found in the current bank or is a silent-failure mode of the old
 * inference rules. The validator is the reason adding a question is now safe:
 * it fails loudly instead of shipping a prompt that scores wrong.
 */

const ERRORS = {
  missingQ: 'no `q`',
  missingClosed: 'missing `closed: true|false` — required; it decides whether an unlisted answer is wrong (0 pts) or real (credited)',
  badGate: (g) => `unknown gate "${g}" — one of: ${Object.keys(GATES).join(', ')}`,
  gateOnClosed: 'has a `gate` but is `closed: true`; the list is the gate, so this does nothing',
  noGateOnOpen: 'is `closed: false` but declares no `gate`; defaulting to "wordlike"',
  emptyTier: (t) => `tier \`${t}\` is empty`,
  noTiers: 'has no answer tiers at all',
  dupWithin: (e, a, b) => `"${e}" appears in both \`${a}\` and \`${b}\``,
  tooFewClosed: (n) => `closed set with only ${n} entries; a closed prompt must plausibly list the whole category, or real answers score 0`,
};

function normaliseEntry(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ');
}

const SUBJECT_STOP = new Set(['name', 'a', 'an', 'the', 'in', 'of', 'or', 'from',
  'with', 'type', 'kind', 'human', 'body', 'our', 'system', 'that', 'is',
  'its', 'own', 'for', 'no', 'and', 'played', 'used', 'over', 'people']);

export function subjectWords(q) {
  return normaliseEntry(q).split(' ').filter((w) => w && !SUBJECT_STOP.has(w));
}

/** Validate one prompt. Returns { errors, warnings }. */
export function validatePrompt(p) {
  const errors = [];
  const warnings = [];

  if (!p.q) errors.push(ERRORS.missingQ);

  if (typeof p.closed !== 'boolean') {
    errors.push(ERRORS.missingClosed);
  } else if (p.closed && p.gate) {
    warnings.push(ERRORS.gateOnClosed);
  } else if (!p.closed && !p.gate) {
    warnings.push(ERRORS.noGateOnOpen);
  }

  if (p.gate && !GATES[p.gate]) errors.push(ERRORS.badGate(p.gate));

  const present = TIER_NAMES.filter((t) => Array.isArray(p[t]));
  if (!present.length) errors.push(ERRORS.noTiers);
  for (const t of present) {
    if (!p[t].length) warnings.push(ERRORS.emptyTier(t));
  }

  // Same answer in two tiers: whichever wins is arbitrary, so it is a bug.
  const seen = new Map();
  let total = 0;
  for (const t of present) {
    for (const entry of p[t]) {
      total++;
      const k = normaliseEntry(entry);
      if (seen.has(k) && seen.get(k) !== t) errors.push(ERRORS.dupWithin(k, seen.get(k), t));
      else seen.set(k, t);
    }
  }

  /* NOTE: an entry that repeats one of the prompt's own subject words ("ship"
   * in "Name a type of boat or ship") is NOT a bug, and this validator used to
   * warn about it wrongly. game.js checks the listed answers BEFORE applying
   * its subject-word rule, so a listed entry always wins — "ship" scores
   * TOPSOIL and "water" scores CLAY, as verified in test-scoring.js. The
   * subject-word rule only ever rejects an UNLISTED guess.
   *
   * Left documented rather than silently dropped: it is a rule worth knowing
   * when reading game.js, and it is the sort of thing that invites a
   * well-meaning "cleanup" that would break five working prompts. */

  /* A closed prompt is a promise that the list is the category, and breaking it
   * scores correct answers as zero. But a SMALL list is not evidence of a broken
   * promise: "a chemical element that is a gas at room temperature" has exactly
   * 11 members and lists all 11, and "a country in South America" has 12.
   * Warning on count alone just cried wolf on the prompts that were most
   * precisely right.
   *
   * So the threshold is deliberately low — it catches a stub (a prompt someone
   * started and did not finish) rather than a genuinely small category. */
  if (p.closed === true && total > 0 && total < 8) {
    warnings.push(ERRORS.tooFewClosed(total));
  }

  return { errors, warnings };
}

/** Validate a whole bank. Returns { ok, report, counts }. */
export function validateBank(bank, label = 'bank') {
  const lines = [];
  let nErr = 0, nWarn = 0;

  const seenQ = new Set();
  for (const p of bank) {
    const { errors, warnings } = validatePrompt(p);

    if (p.q && seenQ.has(p.q)) errors.push('duplicate prompt text');
    if (p.q) seenQ.add(p.q);

    if (errors.length || warnings.length) {
      lines.push(`\n  ${p.q ?? '(no q)'}`);
      for (const e of errors) { lines.push(`    ERROR  ${e}`); nErr++; }
      for (const w of warnings) { lines.push(`    warn   ${w}`); nWarn++; }
    }
  }

  const report = [
    `${label}: ${bank.length} prompts, ${nErr} errors, ${nWarn} warnings`,
    ...lines,
  ].join('\n');

  return { ok: nErr === 0, report, counts: { errors: nErr, warnings: nWarn } };
}

/* ----------------------------------------------------------------- CLI */

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`
    || process.argv[1]?.endsWith('prompt-schema.js')) {
  const { PROMPTS } = await import('./prompts.js');
  const { NORMS_PROMPTS } = await import('./norms-prompts.js');

  const a = validateBank(PROMPTS, 'prompts.js');
  const b = validateBank(NORMS_PROMPTS, 'norms-prompts.js');
  console.log(a.report);
  console.log(b.report);

  if (!a.ok || !b.ok) {
    console.log('\nValidation FAILED. Fix the errors above before shipping.');
    process.exit(1);
  }
  console.log('\nValidation passed.');
}
