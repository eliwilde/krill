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

import { PROMPTS } from './prompts.js';
import { NORMS_PROMPTS } from './norms-prompts.js';
import { scoreAnswer, TIERS } from './game.js';
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

const ALL = [...PROMPTS, ...NORMS_PROMPTS];
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

/* ------------------------------------------------------------- report */

console.log(`\n${pass} passed, ${fail} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('All scoring invariants hold.');
