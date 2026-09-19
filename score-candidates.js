/* STRATA — candidate prompt scorer
 *
 *   node score-candidates.js              rank unused norm categories
 *   node score-candidates.js --all        include categories already in the bank
 *   node score-candidates.js --json       machine-readable, for build-prompts.js
 *
 * WHY THIS EXISTS
 *
 * The bank grows by adding prompts, and the failure mode is not "too few
 * prompts" — it is prompts that do not produce a dig. A prompt only works in
 * this game if it has BOTH halves of the shape:
 *
 *   1. A consensus answer at the top. Someone types the obvious thing, scores
 *      TOPSOIL, and learns the game rewards going deeper. Without it the
 *      opening move is a shrug. ("artistic movement": the most-named answer
 *      got 4 of 20 — there is no obvious thing to blurt.)
 *
 *   2. A long thin tail. Answers almost nobody names, which is the whole
 *      reward loop. Without it every answer scores about the same.
 *      ("prime number": 22% tail, and the members are 2, 3, 5, 7 — there is
 *      nothing to find.)
 *
 * Both halves are measurable from category production norms, which is why this
 * scores candidates mechanically rather than asking anyone's judgement. The
 * measure is how ~20 people actually responded when asked to list members of
 * the category in 60 seconds — real production data, not word frequency and
 * not a guess. That is as close to "what would a player say" as we can get
 * without running the study ourselves.
 *
 * WHAT IT DOES NOT TELL YOU
 *
 * Nothing here judges whether a prompt is INTERESTING, fair, or unambiguous.
 * "personal quality" scores well and would still make a poor prompt: the
 * category boundary is vague, so players cannot tell a wrong answer from an
 * unlisted one. Mechanical suitability is a filter, not a verdict — it rejects
 * the clearly unusable and ranks the rest for a human to choose from.
 *
 * Source: Banks, B. & Connell, L. (2022). Category production norms for 117
 * concrete and abstract categories. Behavior Research Methods. CC-BY 4.0.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(__dirname, 'Referential version_Item level data.csv');
const BUILD = path.join(__dirname, 'build-prompts.js');

/* Participants per category in the source study. The raw production frequency
 * is a count out of this, so it is the denominator for every share below. */
const PARTICIPANTS = 20;

/* CALIBRATION. Run with --all and these thresholds reject 11 of the 63
 * categories already shipped, which is the useful way to read them: they are
 * set where a prompt starts to get marginal, not where it becomes unusable.
 *
 * Some of those 11 are fair hits — "part of the face" has a 23% tail, so there
 * is genuinely little to dig for. Others are borderline by a hair ("snake",
 * 23 answers against a threshold of 24). That is why nothing here blocks a
 * build: this ranks and warns, and a shipped prompt that scores badly is a
 * prompt to re-examine, not one to delete.
 *
 * A prompt needs enough distinct answers to fill five tiers without the tiers
 * becoming one answer each. Below this the proportional split is meaningless. */
const MIN_MEMBERS = 24;

/* The most-named answer must be named by at least this share. This is the
 * "obvious thing to blurt" test — it is what makes the first move of a round
 * feel like a move rather than a guess. */
const MIN_CONSENSUS = 0.45;

/* Share of answers named by exactly one participant. These are the deep tiers.
 * Too few and there is nothing to dig for; the game has no reward gradient. */
const MIN_TAIL = 0.35;

function parseCsv() {
  const lines = readFileSync(CSV, 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const iCat = head.indexOf('category');
  const iMem = head.indexOf('category.member');
  const iFreq = head.indexOf('prod.freq');
  const iDom = head.indexOf('domain');
  if (iCat < 0 || iMem < 0 || iFreq < 0) {
    throw new Error('unexpected CSV columns — expected category/category.member/prod.freq');
  }

  const cats = new Map();
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(',');
    const cat = (f[iCat] ?? '').trim();
    const mem = (f[iMem] ?? '').trim();
    const freq = Number(f[iFreq]);
    if (!cat || !mem || !Number.isFinite(freq)) continue;
    if (!cats.has(cat)) cats.set(cat, { domain: (f[iDom] ?? '').trim(), members: [] });
    cats.get(cat).members.push({ mem, freq });
  }
  return cats;
}

/* Categories already wired into build-prompts.js, read from its USE table so
 * the two cannot drift. */
function usedCategories() {
  const src = readFileSync(BUILD, 'utf8');
  return new Set([...src.matchAll(/^\s*'([^']+)':\s*'Name /gm)].map((m) => m[1]));
}

function score(members) {
  const freqs = members.map((m) => m.freq).sort((a, b) => b - a);
  const n = freqs.length;
  const consensus = freqs[0] / PARTICIPANTS;
  const tail = freqs.filter((f) => f === 1).length / n;

  const reasons = [];
  if (n < MIN_MEMBERS) reasons.push(`only ${n} answers (need ${MIN_MEMBERS})`);
  if (consensus < MIN_CONSENSUS) {
    reasons.push(`no obvious answer (top named by ${freqs[0]}/${PARTICIPANTS})`);
  }
  if (tail < MIN_TAIL) reasons.push(`thin tail (${(tail * 100).toFixed(0)}% named once)`);

  /* Rank usable candidates by how much room there is between the obvious
   * answer and the tail — that gap IS the dig. Size breaks ties, since more
   * answers means more rounds before a category is exhausted. */
  const rank = consensus * tail * Math.log10(n);

  return { n, consensus, tail, rank, ok: reasons.length === 0, reasons };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const showAll = args.has('--all');
  const asJson = args.has('--json');

  const cats = parseCsv();
  const used = usedCategories();

  const rows = [];
  for (const [cat, { domain, members }] of cats) {
    const inBank = used.has(cat);
    if (inBank && !showAll && !asJson) continue;
    rows.push({ cat, domain, inBank, ...score(members) });
  }
  rows.sort((a, b) => b.rank - a.rank);

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const usable = rows.filter((r) => r.ok);
  const rejected = rows.filter((r) => !r.ok);

  console.log(`category production norms: ${cats.size} categories`);
  console.log(`already in the bank: ${used.size}`);
  console.log(`${showAll ? 'scoring all' : 'scoring unused'}: ${rows.length}\n`);

  console.log('--- usable candidates, best first ---');
  console.log('consensus = share naming the top answer (the blurt)');
  console.log('tail      = share of answers named by only one person (the dig)\n');
  console.log('  rank  n    cons  tail  category');
  for (const r of usable) {
    const flag = r.inBank ? ' *' : '';
    console.log(
      `  ${r.rank.toFixed(2)}  ${String(r.n).padStart(3)}  ${(r.consensus * 100).toFixed(0).padStart(3)}%  `
      + `${(r.tail * 100).toFixed(0).padStart(3)}%  ${r.cat}${flag}`,
    );
  }
  if (showAll) console.log('\n  * already in the bank');

  console.log(`\n--- rejected (${rejected.length}) ---`);
  for (const r of rejected) {
    console.log(`  ${r.cat.padEnd(28)} ${r.reasons.join('; ')}`);
  }

  console.log(`\n${usable.length} usable, ${rejected.length} rejected.`);
  console.log('Mechanical suitability only — it does not judge whether a prompt');
  console.log('is interesting or whether its category boundary is clear enough to');
  console.log('score fairly. Read the list, do not just take the top N.');
}

main();
