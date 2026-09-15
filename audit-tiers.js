/* STRATA — tier audit
 *
 * Checks hand-assigned tiers against MEASURED word prevalence: the proportion
 * of people who report knowing a word, from Brysbaert, Mandera, McCormick &
 * Keuleers (2019), "Word prevalence norms for 62,000 English lemmas"
 * (Behavior Research Methods 51(2)), ~220,000 participants.
 *
 *   node audit-tiers.js            audit the hand-written bank
 *   node audit-tiers.js --norms    audit the generated bank too
 *   node audit-tiers.js --all      every entry, not just disagreements
 *
 * WHAT THIS CAN AND CANNOT TELL YOU
 *
 * Prevalence measures "do you know this word", NOT "would you say it when
 * asked to name a cheese". Those come apart, and the gap is the whole reason
 * this is an advisory tool and not a tier generator:
 *
 *   - Nearly everyone knows "moon", "heart" and "period". Those sit in
 *     surface because they are the first thing people SAY, which prevalence
 *     agrees with only by coincidence.
 *   - Nearly everyone knows "jupiter" and "mars" too, but for "name a moon"
 *     they are wrong answers, and prevalence has no opinion on that.
 *   - Almost nobody knows "aardwolf" (21%), and it would indeed be a deep
 *     answer for "name an animal". Here the two line up.
 *
 * So a disagreement is a PROMPT to re-examine an entry, never a verdict. The
 * signal is strongest at the extremes: a 99%-known word sitting in `deep` is
 * probably misfiled; a 20%-known word sitting in `surface` almost certainly is.
 *
 * COVERAGE IS THE REAL LIMIT. The norms are single-word English lemmas, so
 * proper nouns (juneau, vesuvius), multi-word answers (mount st helens) and
 * transliterations (popocatepetl) are simply absent — and those are a large
 * share of a bank built on closed sets. Unmatched entries are reported, never
 * guessed at.
 */

import { readFileSync } from 'node:fs';
import { PROMPTS as HAND } from './prompts.js';

const TSV = process.env.PREVALENCE_TSV
  ?? 'C:/Users/elili/AppData/Local/Temp/claude/c--Users-elili-OneDrive-Desktop-Projects-krill/076a9de6-eacb-46b1-b16e-7213e9d16f18/scratchpad/prevalence_full.tsv';

const TIERS = ['surface', 'tooclever', 'common', 'good', 'deep'];

/* Expected prevalence band per tier, as Pknown (proportion who know the word).
 *
 * These are deliberately WIDE. The aim is to catch entries that are plainly
 * misfiled, not to enforce a tight mapping that prevalence cannot support —
 * a narrow band would flag hundreds of entries and the report would be noise.
 * Only a word outside its band is reported. */
const BAND = {
  surface:   { lo: 0.90, hi: 1.01 },  // everyone blurts it -> everyone knows it
  tooclever: { lo: 0.85, hi: 1.01 },
  common:    { lo: 0.70, hi: 1.01 },
  good:      { lo: 0.40, hi: 0.99 },
  deep:      { lo: 0.00, hi: 0.95 },  // obscure answers should not be near-universal
};

/* Matches game.js normalise(), minus the plural trim — the norms list lemmas,
 * and trimming here would turn "iris" into "iri". */
function norm(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/[^a-z0-9\s'-]/g, '')
    .replace(/\s+/g, ' ');
}

function loadPrevalence(path) {
  const text = readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/);
  const head = lines[0].split('\t');
  const wi = head.indexOf('Word');
  const pi = head.indexOf('Pknown');
  if (wi < 0 || pi < 0) throw new Error(`unexpected columns: ${head.join(', ')}`);

  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = lines[i].split('\t');
    const w = norm(f[wi]);
    const p = Number(f[pi]);
    if (!w || !Number.isFinite(p)) continue;
    // Keep the highest reading if a lemma appears twice after normalising.
    if (!map.has(w) || map.get(w) < p) map.set(w, p);
  }
  return map;
}

/* Look up an entry. Multi-word entries have no lemma of their own, so we fall
 * back to the rarest word in the phrase: "snow leopard" is gated by whichever
 * of snow/leopard fewer people know. Reported separately so a phrase-derived
 * number is never mistaken for a direct measurement. */
function lookup(prev, entry) {
  const key = norm(entry);
  if (prev.has(key)) return { p: prev.get(key), how: 'exact' };

  const words = key.split(' ').filter(Boolean);
  if (words.length > 1) {
    const found = words.map((w) => prev.get(w)).filter((v) => v !== undefined);
    if (found.length === words.length) {
      return { p: Math.min(...found), how: 'phrase' };
    }
  }
  return null;
}

function pct(p) {
  return `${(p * 100).toFixed(0)}%`;
}

/* Which tier a prevalence reading is most consistent with — for the
 * suggestion column only. Advisory, see the header note. */
function suggest(p) {
  for (const t of TIERS) {
    const b = BAND[t];
    if (p >= b.lo && p <= b.hi) return t;
  }
  return p < BAND.good.lo ? 'deep' : 'surface';
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const showAll = args.has('--all');

  let bank = HAND;
  let label = 'hand-written (prompts.js)';
  if (args.has('--norms')) {
    const { NORMS_PROMPTS } = await import('./norms-prompts.js');
    bank = [...HAND, ...NORMS_PROMPTS];
    label = 'hand-written + generated';
  }

  const prev = loadPrevalence(TSV);
  console.log(`prevalence norms: ${prev.size.toLocaleString()} lemmas`);
  console.log(`auditing: ${label} — ${bank.length} prompts\n`);

  let total = 0, matched = 0, phrase = 0, flagged = 0;
  const byTier = Object.fromEntries(TIERS.map((t) => [t, { n: 0, sum: 0 }]));
  const misses = [];
  const rows = [];

  for (const p of bank) {
    for (const tier of TIERS) {
      for (const entry of p[tier] ?? []) {
        total++;
        const hit = lookup(prev, entry);
        if (!hit) { misses.push(entry); continue; }
        matched++;
        if (hit.how === 'phrase') phrase++;

        byTier[tier].n++;
        byTier[tier].sum += hit.p;

        const b = BAND[tier];
        const off = hit.p < b.lo || hit.p > b.hi;
        if (off) flagged++;
        if (off || showAll) {
          rows.push({
            q: p.q, entry, tier, p: hit.p, how: hit.how,
            sug: suggest(hit.p), off,
          });
        }
      }
    }
  }

  // Report grouped by prompt, worst disagreement first within each.
  rows.sort((a, b) => (a.q === b.q ? a.p - b.p : a.q.localeCompare(b.q)));
  let cur = null;
  for (const r of rows) {
    if (r.q !== cur) { cur = r.q; console.log(`\n${cur}`); }
    const mark = r.off ? '!' : ' ';
    const via = r.how === 'phrase' ? ' (phrase)' : '';
    const sug = r.off ? `  -> looks like ${r.sug}` : '';
    console.log(`  ${mark} ${r.entry.padEnd(24)} ${r.tier.padEnd(10)} ${pct(r.p).padStart(4)}${via}${sug}`);
  }

  console.log('\n--- mean prevalence by tier ---');
  console.log('(should fall monotonically; if it does not, the tiers are not tracking obscurity)');
  for (const t of TIERS) {
    const { n, sum } = byTier[t];
    if (!n) { console.log(`  ${t.padEnd(10)} no matches`); continue; }
    console.log(`  ${t.padEnd(10)} ${pct(sum / n).padStart(4)}  (n=${n})`);
  }

  console.log('\n--- coverage ---');
  console.log(`  entries          ${total}`);
  console.log(`  matched          ${matched} (${pct(matched / total)}) — ${phrase} via phrase fallback`);
  console.log(`  unmatched        ${misses.length} (${pct(misses.length / total)})`);
  console.log(`  flagged          ${flagged} of ${matched} matched`);
  console.log('\n  Unmatched entries are mostly proper nouns and multi-word answers,');
  console.log('  which these norms do not cover. Absence is not evidence of rarity.');
  if (misses.length) {
    console.log(`\n  sample: ${misses.slice(0, 12).join(', ')}`);
  }
}

main();
