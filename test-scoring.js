/* STRATA — scoring regression tests.
 *
 *   node test-scoring.js
 *
 * WHY THIS EXISTS
 *
 * The repo had no test runner, and that is precisely how a 70-point bug
 * shipped: on every open prompt, "gorbleflax" scored the same UNCHARTED 70 as
 * "hoatzin". Nothing was watching, so nothing complained.
 *
 * These are the invariants the game is actually FOR. They are written as
 * behaviour ("gibberish must not outscore a real obscure answer"), not as
 * implementation, so you can refactor the gate freely and these still hold.
 *
 * ADDING A QUESTION: run this. It validates both banks and re-checks the
 * invariants against every prompt, so a new prompt with a bad `closed` flag or
 * a missing gate fails here instead of in front of a player.
 */

import { readFileSync } from 'node:fs';
import { PROMPTS } from './prompts.js';
import { NORMS_PROMPTS } from './norms-prompts.js';
import { scoreAnswer, TIERS, ALL_PROMPTS, buildDailyRound, CONFIG } from './game.js';
import { logSubmission, summarise } from './submission-log.js';
import {
  validateBank, loadLexicon, normalise, isTypoOf,
  passesGate, inLexicon, TIER_NAMES,
} from './prompt-schema.js';

loadLexicon();

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; return; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function eq(name, got, want) {
  check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

/* The MERGED bank — what the scorer really sees, with reject lists attached.
 * Using the raw prompts.js export here was a bug in this file: it tested
 * prompts without their REJECTS, so a reject that never fired looked fine. */
const ALL = ALL_PROMPTS;
const byQ = (frag) => ALL.find((p) => p.q.toLowerCase().includes(frag.toLowerCase()));

/* ----------------------------------------------------- 1. bank validation */

for (const [bank, label] of [[PROMPTS, 'prompts.js'], [NORMS_PROMPTS, 'norms-prompts.js']]) {
  const { ok, report, counts } = validateBank(bank, label);
  check(`${label} validates`, ok, `${counts.errors} errors\n${report}`);
}

/* Every prompt must declare `closed`. This is the single most important
 * structural rule: get it wrong and either gibberish pays out (open when it
 * should be closed) or correct answers score zero (the reverse). */
for (const p of ALL) {
  check(`"${p.q}" declares closed`, typeof p.closed === 'boolean');
}

/* ------------------------------------------- 2. the bug this was built for */

const MASH = ['gorbleflax', 'krongwattle', 'zzzyphus', 'flurgle', 'blarghsnk',
  'thrbvkl', 'skrtlpz', 'vbnmqwr', 'plkjhgf', 'grshplnk', 'asdfgh', 'xkcdvb'];

for (const p of ALL) {
  for (const junk of MASH.slice(0, 4)) {
    const r = scoreAnswer(p, junk);
    check(`"${p.q}" scores 0 for "${junk}"`, r.pts === 0,
      `scored ${r.pts} (${r.tier})`);
  }
}

/* The invariant behind it: no unverified answer may ever outscore a listed
 * FOSSIL BED, because we measured that one and we are guessing at this one. */
check('UNCHARTED never beats FOSSIL BED',
  (TIERS.deep?.pts ?? 85) >= 70);

/* ------------------------------------------- 3. real answers still score */

/* Listed answers must score their own tier, exactly. This is the contract the
 * whole tiering effort rests on, so it is checked across the entire bank
 * rather than on a sample. */
let tierMismatch = 0;
const mismatchEx = [];
for (const p of ALL) {
  for (const tier of TIER_NAMES) {
    for (const entry of p[tier] ?? []) {
      const r = scoreAnswer(p, entry);
      if (r.tier !== tier) {
        tierMismatch++;
        if (mismatchEx.length < 10) {
          mismatchEx.push(`${p.q}: "${entry}" is listed ${tier} but scored ${r.tier}`);
        }
      }
    }
  }
}
check('every listed answer scores its own tier', tierMismatch === 0,
  `${tierMismatch} mismatches:\n    ${mismatchEx.join('\n    ')}`);

/* Real obscure answers on open prompts must still be credited. These are the
 * answers the game exists to reward; rejecting one is worse than accepting a
 * mash, so they are asserted individually. */
const OBSCURE_OK = [
  ['Name a bird', 'hoatzin'], ['Name a bird', 'kea'], ['Name a bird', 'chough'],
  ['Name a bird', 'ptarmigan'], ['Name a bird', 'snow petrel'],
  ['Name a fruit', 'mangosteen'], ['Name a fruit', 'kumquat'],
  ['Name a fish', 'tetra'],
];
for (const [q, ans] of OBSCURE_OK) {
  const p = byQ(q);
  if (!p) continue;
  const r = scoreAnswer(p, ans);
  check(`"${q}" credits "${ans}"`, r.pts > 0, `scored ${r.pts} (${r.tier})`);
}

/* A LISTED entry that repeats one of the prompt's own subject words still
 * scores — game.js checks the lists before applying its subject-word rule. This
 * is pinned because it looks like dead data and invites a "cleanup" that would
 * silently break five working prompts. The rule only rejects UNLISTED guesses. */
const SUBJECT_LISTED = [
  ['Name a type of boat or ship', 'ship'],
  ['Name a body of water', 'water'],
  ['Name a street suffix', 'street'],
  ['Name a cryptid', 'bigfoot'],
];
for (const [q, ans] of SUBJECT_LISTED) {
  const p = byQ(q);
  if (!p) continue;
  const listed = TIER_NAMES.some((t) => (p[t] ?? []).some((e) => normalise(e) === normalise(ans)));
  if (!listed) continue;
  check(`listed subject word "${ans}" still scores on "${q}"`,
    scoreAnswer(p, ans).pts > 0);
}

/* The flip side: the same word UNLISTED must be rejected as "the category
 * itself" rather than credited. */
{
  const p = byQ('Name a type of knot');
  if (p) eq('unlisted subject word is rejected', scoreAnswer(p, 'knot').pts, 0);
}

/* ------------------------------- 3b. wrong-category answers must not pay
 *
 * The bug that motivated this section: the lexicon gate asks "is this a real
 * word", which is NOT the same as "is this a real answer". "pizza" is a real
 * word, so on an open prompt it scored 70 — more than reaching a genuine
 * good-tier answer. The defence is the `closed` flag, so these assert that the
 * prompts where players actually hit this are closed or reject-listed. */
const WRONG_CATEGORY = [
  ['Name a literary device', 'rubric'],
  ['Name a literary device', 'pizza'],
  ['Name a strait', 'river'],
  ['Name a strait', 'mountain'],
  ['Name a household chore', 'wisk'],
  ['Name a household chore', 'trombone'],
  ['Name a subatomic particle', 'bicycle'],
  ['Name a part of the human eye', 'elbow'],
  ['Name a type of paper', 'elephant'],
  ["Name a palindrome that's a real English dictionary word", 'river'],
];
for (const [q, ans] of WRONG_CATEGORY) {
  const p = byQ(q);
  if (!p) { check(`prompt exists: "${q}"`, false); continue; }
  eq(`"${ans}" scores 0 on "${p.q.slice(0, 40)}"`, scoreAnswer(p, ans).pts, 0);
}

/* The palindrome prompt is mechanically decidable, so it should credit an
 * unlisted real palindrome and reject a non-palindrome outright. */
{
  const p = byQ("Name a palindrome that's a real");
  if (p) {
    for (const w of ['rotator', 'redder', 'racecar', 'kayak']) {
      check(`palindrome "${w}" is credited`, scoreAnswer(p, w).pts > 0);
    }
    for (const w of ['river', 'banana', 'almost']) {
      eq(`non-palindrome "${w}" scores 0`, scoreAnswer(p, w).pts, 0);
    }
  }
}

/* Every REJECTS and VERIFIERS key must match a real prompt. A typo in either
 * table silently disables it — which happened while writing this, so it is
 * pinned. Both live in game.js keyed by exact prompt text. */
{
  const src = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
  const qs = new Set(ALL.map((p) => p.q));
  // Keys are the quoted strings at the start of a line inside either table.
  for (const m of src.matchAll(/^\s{2}(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"):\s*(?:\[|\()/gm)) {
    const key = (m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (!key.startsWith('Name ')) continue;
    check(`table key matches a real prompt: "${key.slice(0, 48)}"`, qs.has(key));
  }
}

/* ---------------------- 3c. how people actually type answers
 *
 * All reported from real play. Each one is a correct answer that scored NOTHING,
 * which reads as the game being broken rather than the player being wrong. */

/* Abbreviations ARE street suffixes — on signage the abbreviation is the normal
 * form, and the prompt's example invites it. "rd" scoring 0 while "road" scored
 * 10 was the game contradicting itself. */
{
  const p = byQ('Name a street suffix');
  if (p) for (const w of ['rd', 'st', 'ave', 'blvd', 'dr', 'ln', 'hwy']) {
    check(`street suffix abbreviation "${w}" scores`, scoreAnswer(p, w).pts > 0);
  }
}

/* The distinctive word of a compound answer is the answer. Nobody says "Venn
 * diagram" when the category is already charts. */
{
  const p = byQ('Name a type of graph or chart');
  if (p) for (const w of ['gantt', 'venn', 'pie', 'bar', 'sankey', 'box']) {
    check(`chart fragment "${w}" scores`, scoreAnswer(p, w).pts > 0);
  }
}

/* ...but a bare modifier is still not an answer. */
{
  const p = byQ('Name a type of home or dwelling');
  if (p) for (const w of ['long', 'farm', 'stilt']) {
    eq(`bare modifier "${w}" scores 0`, scoreAnswer(p, w).pts, 0);
  }
}

/* -ology and -phobia are open, so the suffix makes fabrication easy. Real terms
 * must pay; coinages and non-sciences must not. */
{
  const p = byQ('Name a branch of science ending in -ology');
  if (p) {
    for (const w of ['speleology', 'vexillology', 'biology', 'malacology']) {
      check(`real -ology "${w}" scores`, scoreAnswer(p, w).pts > 0);
    }
    for (const w of ['scientology', 'astrology', 'numerology', 'flurgology']) {
      eq(`non-science -ology "${w}" scores 0`, scoreAnswer(p, w).pts, 0);
    }
  }
}
{
  const p = byQ('Name a phobia');
  if (p) {
    for (const w of ['necrophobia', 'nomophobia', 'arachnophobia']) {
      check(`real phobia "${w}" scores`, scoreAnswer(p, w).pts > 0);
    }
    for (const w of ['lassophobia', 'flurglephobia']) {
      eq(`invented phobia "${w}" scores 0`, scoreAnswer(p, w).pts, 0);
    }
  }
}

/* A verifier's NO must never beat the curated lists. Getting this backwards
 * made the two verifiers above reject 32 of their OWN listed answers. */
for (const q of ['Name a branch of science ending in -ology', 'Name a phobia']) {
  const p = byQ(q);
  if (!p) continue;
  for (const tier of TIER_NAMES) {
    for (const entry of p[tier] ?? []) {
      check(`listed "${entry}" survives its verifier`, scoreAnswer(p, entry).pts > 0);
    }
  }
}

/* ---------------- 3d. UNCHARTED must never beat a measured answer
 *
 * THE WORST BUG FOUND SO FAR. UNCHARTED paid 70, above CLAY (30) and SHALE
 * (60), which made truncation a dominant strategy: "whis" scored 70 while
 * "whiskey" scored 10, and "poly" beat "polyester" 70 to 60. Across the open
 * bank there were 5,469 cases where an unlisted FRAGMENT of a listed answer
 * outscored the answer itself. A player who noticed would stop naming things
 * and type four-letter stubs.
 *
 * UNCHARTED is now 8, below TOPSOIL's 10. Naming the obvious thing always beats
 * gesturing at something we cannot check. */
check('UNCHARTED pays less than the shallowest measured tier',
  scoreAnswer({ q: 'x', closed: false, gate: 'lenient', surface: ['zzz'] }, 'somethingelse').pts
    < TIERS.surface.pts);

{
  let exploits = 0;
  const worst = [];
  for (const p of ALL) {
    for (const tier of TIER_NAMES) {
      for (const entry of p[tier] ?? []) {
        const full = scoreAnswer(p, entry);
        for (const len of [4, 5, 6]) {
          if (entry.length <= len) continue;
          const frag = entry.toLowerCase().slice(0, len);
          if (!/^[a-z]+$/.test(frag)) continue;
          const partial = scoreAnswer(p, frag);
          // Only a problem when the fragment is UNVERIFIED — a fragment that is
          // itself a listed answer ("screw" in a building-material list) is
          // legitimately its own answer and may well be deeper.
          if (partial.tier === 'unverified' && partial.pts > full.pts) {
            exploits++;
            if (worst.length < 8) worst.push(`"${frag}"=${partial.pts} > "${entry}"=${full.pts} (${p.q})`);
          }
        }
      }
    }
  }
  check('no unlisted fragment outscores the answer it truncates',
    exploits === 0, `${exploits} exploits:\n    ${worst.join('\n    ')}`);
}

/* An ambiguous fragment takes the SHALLOWER reading. "blue" matches both "blue
 * jay" (surface) and "blue tit" (good); paying the deeper one handed out 60
 * points for a modifier. */
{
  const p = byQ('Name a bird');
  if (p) {
    const r = scoreAnswer(p, 'blue');
    check('ambiguous fragment takes the shallower tier',
      r.tier === 'surface' || r.pts === 0, `got ${r.tier} (${r.pts})`);
  }
}

/* Unambiguous typos are forgiven; ambiguous ones are not. */
{
  const p = byQ('Name a part of the human eye');
  if (p) {
    const r = scoreAnswer(p, 'cornia');
    check('unambiguous typo "cornia" reads as cornea', r.pts > 0, `got ${r.pts}`);
  }
  /* A typo may never pay MORE than spelling it correctly — EXCEPT where the
   * misspelling legitimately lands on a different listed answer. "chaise" and
   * "chaise lounge" are both listed for furniture, at deep (85) and good (60),
   * so "chaise loune" correctly reaches "chaise". That is the data's shape, not
   * a scoring bug, so a mangled entry whose prefix is itself listed is skipped. */
  const listedIn = (p2, word) => TIER_NAMES.some((t) =>
    (p2[t] ?? []).some((e) => normalise(e) === word));

  for (const p2 of ALL) {
    for (const tier of TIER_NAMES) {
      for (const entry of (p2[tier] ?? []).slice(0, 3)) {
        const e = normalise(entry);
        if (e.length < 7) continue;
        const typo = e.slice(0, -2) + e.slice(-1);   // drop one letter
        // Skip when any leading word of the entry is its own listed answer.
        const words = e.split(' ');
        if (words.length > 1 && words.some((_, i) => listedIn(p2, words.slice(0, i + 1).join(' ')))) continue;
        const rt = scoreAnswer(p2, typo), re = scoreAnswer(p2, entry);
        if (rt.pts > re.pts) {
          check(`typo of "${entry}" does not outscore it`, false, `${rt.pts} > ${re.pts}`);
        }
      }
    }
  }
}

/* ------------------------------------------ 3e. aliases score their canonical
 *
 * An alias must score EXACTLY what the answer it stands for scores — never zero
 * (the bug it exists to fix: "czechia" is Czech Republic) and never more (which
 * would make the alias a route to a deeper tier than the real answer). */
for (const p of ALL) {
  if (!p.aliases) continue;
  for (const [alias, canonical] of Object.entries(p.aliases)) {
    const ra = scoreAnswer(p, alias);
    const rc = scoreAnswer(p, canonical);
    eq(`alias "${alias}" scores as "${canonical}"`, ra.pts, rc.pts);
    check(`alias "${alias}" scores above zero`, ra.pts > 0);
  }
}

/* ------------------------------------------------- 4. closed-set strictness */

/* On a closed set, a wrong answer is wrong however real the word is. "banana"
 * is a perfectly good English word and a terrible Greek god. */
const CLOSED_WRONG = [
  ['Greek god', 'banana'], ['Greek letter', 'hydrogen'],
  ['Greek god', 'quarterback'],
];
for (const [q, ans] of CLOSED_WRONG) {
  const p = byQ(q);
  if (!p) continue;
  if (p.closed !== true) continue;
  eq(`closed "${p.q}" rejects "${ans}"`, scoreAnswer(p, ans).pts, 0);
}

/* ------------------------------------------------ 5. normalisation & typos */

eq('diacritics fold', normalise('café'), normalise('cafe'));
eq('jalapeño folds', normalise('jalapeño'), 'jalapeno');
eq('leading article stripped', normalise('The Moon'), 'moon');
eq('plural trimmed', normalise('ramens'), 'ramen');

check('typo forgiven (long word)', isTypoOf('quarterback', 'quarterbak'));
check('typo forgiven (10 chars)', isTypoOf('arachnophobia', 'arachnaphobia'));
check('short words get no slack', !isTypoOf('io', 'in'));
check('distinct short words never collide', !isTypoOf('mars', 'mar'));
check('roman numerals never merge', !isTypoOf('henry v', 'henry vi'));
check('minimal pairs never merge', !isTypoOf('beta', 'zeta'));

/* THE KEY SAFETY PROPERTY.
 *
 * Scoring must be EXACT against listed answers. This test documents why, by
 * measuring what fuzzy matching would do if it were used there: it merges real,
 * distinct answers that sit in different tiers. The count is informational —
 * what is asserted is that the SCORER does not do this, checked below. */
let collisions = 0;
const collEx = [];
for (const p of ALL) {
  const entries = [];
  for (const t of TIER_NAMES) for (const e of p[t] ?? []) entries.push([normalise(e), t]);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [a, ta] = entries[i], [b, tb] = entries[j];
      if (a !== b && ta !== tb && isTypoOf(a, b)) {
        collisions++;
        if (collEx.length < 8) collEx.push(`"${a}" (${ta}) ~ "${b}" (${tb}) in ${p.q}`);
      }
    }
  }
}
if (collisions) {
  console.log(`\n  note: ${collisions} listed answers are within typo distance of an`);
  console.log('  answer in a different tier. This is exactly why the scorer matches');
  console.log('  listed answers EXACTLY and never fuzzily. Examples:');
  for (const e of collEx) console.log(`    ${e}`);
}

/* The assertion that matters: scoring a near-miss of a listed answer must
 * never pay out that answer's tier. A player typing "tebibyte" gets tebibyte's
 * score, never mebibyte's. */
const NEAR_MISS = [
  ['Name a unit of digital storage or data', 'mebibyte', 'tebibyte'],
  ['Name a Greek letter', 'epsilon', 'upsilon'],
];
for (const [q, a, b] of NEAR_MISS) {
  const p = byQ(q);
  if (!p) continue;
  const ra = scoreAnswer(p, a), rb = scoreAnswer(p, b);
  const ta = TIER_NAMES.find((t) => (p[t] ?? []).some((e) => normalise(e) === normalise(a)));
  const tb = TIER_NAMES.find((t) => (p[t] ?? []).some((e) => normalise(e) === normalise(b)));
  if (ta && tb && ta !== tb) {
    eq(`"${a}" scores its own tier, not "${b}"'s`, ra.tier, ta);
    eq(`"${b}" scores its own tier, not "${a}"'s`, rb.tier, tb);
  }
}

/* ------------------------------------------------------------ 6. lexicon */

check('lexicon loaded', inLexicon('hoatzin'), 'prevalence.tsv missing or unreadable');
check('lexicon excludes mash', !inLexicon('gorbleflax'));
for (const w of ['borscht', 'kvass', 'okapi', 'quetzal']) {
  check(`gate accepts real word "${w}"`, passesGate({ gate: 'wordlike' }, w));
}
for (const w of MASH) {
  check(`gate rejects mash "${w}"`, !passesGate({ gate: 'wordlike' }, w));
}

/* ---------------------------------------------- 7. day freeze + logging */

/* The frozen round must be identical for every player on a given UTC day. This
 * is the precondition for tiering from submissions: if the prompt set or its
 * tiers move within a day, every row is collected under different conditions and
 * the data is not norms. */
{
  const qs = (r) => r.prompts.map((p) => p.q).join('|');
  const morning = buildDailyRound(new Date('2026-09-18T00:00:00Z'));
  const night = buildDailyRound(new Date('2026-09-18T23:59:59Z'));
  const next = buildDailyRound(new Date('2026-09-19T12:00:00Z'));

  eq('day key is the UTC date', morning.key, '2026-09-18');
  eq('same day is byte-identical', qs(morning), qs(night));
  check('a different day differs', qs(morning) !== qs(next));
  eq('frozen round is a full round', morning.prompts.length, CONFIG.ROUND_LENGTH);

  // No prompt twice in one frozen round, and no known clashing pair.
  const seen = new Set(morning.prompts.map((p) => p.q));
  eq('frozen round has no duplicate prompts', seen.size, morning.prompts.length);

  // Over two months it should use most of the bank, not cycle a handful.
  const used = new Set();
  for (let d = 0; d < 60; d++) {
    for (const p of buildDailyRound(new Date(Date.UTC(2026, 8, 18 + d))).prompts) used.add(p.q);
  }
  check('60 days of frozen rounds use most of the bank',
    used.size > ALL.length * 0.7, `used ${used.size} of ${ALL.length}`);
}

/* The logger must never throw and must never lose the raw input. Both are load-
 * bearing: it runs on the hot path, and the raw text is the whole dataset. */
{
  const prompt = byQ('Name a bird');
  const res = scoreAnswer(prompt, 'ROBIN  ');

  // No localStorage under Node — which is exactly the "storage blocked" case the
  // logger has to survive. If it throws here it would throw in a private window.
  const row = logSubmission({
    prompt, raw: '  ROBIN  ', result: res, latencyMs: 1234.7, promptIndex: 2,
  });

  check('logSubmission survives absent localStorage', row !== undefined);
  if (row) {
    eq('raw input is preserved un-coerced', row.raw, '  ROBIN  ');
    eq('tier is recorded', row.tier, res.tier);
    eq('points are recorded', row.pts, res.pts);
    eq('latency is rounded to ms', row.ms, 1235);
    eq('prompt is identified', row.prompt, prompt.q);
    check('timestamp is ISO UTC', /^\d{4}-\d{2}-\d{2}T.*Z$/.test(row.at));
  }

  // Malformed input must not throw either — the hot path has no try/catch to spare.
  for (const bad of [undefined, null, {}, 0, NaN]) {
    let threw = false;
    try { logSubmission({ prompt, raw: bad, result: res, latencyMs: bad }); }
    catch { threw = true; }
    check(`logSubmission survives raw=${JSON.stringify(bad)}`, !threw);
  }
  let threw = false;
  try { logSubmission({}); } catch { threw = true; }
  check('logSubmission survives an empty entry', !threw);
}

/* ------------------------------------------------------------- report */

console.log(`\n${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('All scoring invariants hold.');
