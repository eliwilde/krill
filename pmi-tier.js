/* pmi-tier.js — rank candidate answers by association strength, not popularity.
 *
 *   node pmi-tier.js "landlocked" switzerland austria liechtenstein "san marino"
 *   node pmi-tier.js --prompt "Name a bird" bird robin sparrow wagtail
 *
 * WHAT THIS IS FOR
 *
 * When a new prompt has no category-production data (the measured norms behind
 * norms-prompts.js), you have to guess the tier order. This gives that guess a
 * measurement to lean on.
 *
 * THE IDEA (and it is a good one)
 *
 * Raw popularity is the wrong signal. Everyone knows Switzerland, so pageviews
 * rank it high — but people know it for banking, chocolate, neutrality and
 * skiing, and "landlocked" is a footnote. Liechtenstein is far less famous, yet
 * a large share of everything written about it mentions being landlocked. The
 * useful quantity is the RATIO:
 *
 *     P(constraint | entity) ~ hits("entity" AND constraint) / hits("entity")
 *
 * A LOW ratio means the entity is famous for other things, so it is top-of-mind
 * generally and people blurt it first. A HIGH ratio means the entity is
 * defined by the constraint — which, paradoxically, means you only reach it if
 * you are already thinking hard about that constraint. So:
 *
 *     low ratio  -> shallow tier (surface/tooclever)
 *     high ratio -> deep tier
 *
 * This is a proper PMI-style measure rather than a frequency count, and it is
 * the reason it works where pageviews do not.
 *
 * HOW WELL DOES IT WORK? MEASURED, NOT ASSUMED.
 *
 * Validated against ground truth: 13 birds whose true tiers come from ~460
 * participants actually naming birds (Banks & Connell 2022; Battig & Montague
 * 1969), which is the thing this is trying to predict.
 *
 *     Spearman correlation with measured recall order: +0.63
 *
 * That is real signal and clearly better than pageviews (which were
 * non-monotonic on the same kind of test). It is NOT a replacement for measured
 * data. Two visible failures in that sample:
 *
 *   - "osprey" ranked 2nd shallowest; it is genuinely a deep answer. Ospreys are
 *     written about constantly in conservation contexts, and "osprey" is also a
 *     backpack brand and a military aircraft, which dilutes the ratio.
 *   - "ostrich" ranked 12th (deepest); it is a common answer. Almost everything
 *     written about ostriches is about them being birds, so the ratio is high —
 *     but everyone can still name one.
 *
 * The second failure is the systematic one, and worth understanding: this metric
 * confuses "defined by the category" with "hard to think of". A prototypical
 * member of a category (ostrich, penguin) has a high ratio for the same reason
 * an obscure member does. Expect it to misplace prototypes.
 *
 * SO: use it to get a first ordering, then fix it by hand. That is exactly the
 * workflow the Krillion FAQ describes — mechanical pass, then editorial pass —
 * and the editorial pass is not optional.
 */

const UA = 'krill-game/1.0 (https://github.com/eliwilde/krill)';
const API = 'https://en.wikipedia.org/w/api.php';

/* Wikipedia's search index is the corpus. It is a reasonable proxy for
 * "encyclopedic writing about this thing", it needs no API key, and it counts
 * documents rather than raw mentions, which is the more stable quantity.
 *
 * Rate-limited deliberately: the search endpoint is not metered per-key but it
 * is shared infrastructure, and hammering it is both rude and unreliable. */
async function searchHits(query) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: 'query', list: 'search', srsearch: query,
    srlimit: '1', srinfo: 'totalhits', format: 'json', origin: '*',
  });
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${query}`);
  const json = await res.json();
  return json?.query?.searchinfo?.totalhits ?? 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Association ratio for one entity against one constraint word. */
export async function associationRatio(entity, constraint) {
  const total = await searchHits(`"${entity}"`);
  await sleep(120);
  const joint = await searchHits(`"${entity}" ${constraint}`);
  await sleep(120);
  if (!total) return { entity, total: 0, joint, ratio: null };
  return { entity, total, joint, ratio: joint / total };
}

/** Rank entities shallow -> deep. Lower ratio = shallower. */
export async function rankByAssociation(entities, constraint, onProgress) {
  const out = [];
  for (const e of entities) {
    try {
      const r = await associationRatio(e, constraint);
      out.push(r);
      onProgress?.(r);
    } catch (err) {
      out.push({ entity: e, total: 0, joint: 0, ratio: null, error: err.message });
      onProgress?.({ entity: e, error: err.message });
    }
  }
  // Unmeasurable entries sort last rather than being dropped silently.
  return out.sort((a, b) => {
    if (a.ratio == null) return 1;
    if (b.ratio == null) return -1;
    return a.ratio - b.ratio;
  });
}

/* Suggested tier split. The shape matches the existing banks: a small shallow
 * head, a broad middle, a long deep tail.
 *
 * NOTE `tooclever` is NOT assigned here, and cannot be. It is not a frequency
 * band — it is "the answer that FEELS clever but thousands of others also
 * thought was clever". That is a fact about how players reason, not about how
 * often a word co-occurs with anything, and no corpus measure will find it.
 * It stays a purely editorial judgement. This is the same reason the tier broke
 * monotonicity in every metric tested: it is orthogonal to frequency by design.
 */
const SPLIT = [
  ['surface', 0.10],
  ['common', 0.35],
  ['good', 0.70],
  ['deep', 1.00],
];

export function assignTiers(ranked) {
  const usable = ranked.filter((r) => r.ratio != null);
  return ranked.map((r) => {
    if (r.ratio == null) return { ...r, tier: null };
    const pos = usable.indexOf(r) / Math.max(1, usable.length - 1);
    const tier = SPLIT.find(([, hi]) => pos <= hi)?.[0] ?? 'deep';
    return { ...r, tier };
  });
}

/* --------------------------------------------------------------------- CLI */

if (process.argv[1]?.endsWith('pmi-tier.js')) {
  const args = process.argv.slice(2);
  let promptLabel = null;
  if (args[0] === '--prompt') { promptLabel = args[1]; args.splice(0, 2); }

  const [constraint, ...entities] = args;
  if (!constraint || !entities.length) {
    console.log('usage: node pmi-tier.js <constraint-word> <entity> [entity...]');
    console.log('       node pmi-tier.js --prompt "Name a bird" bird robin wagtail');
    process.exit(1);
  }

  console.log(`constraint: "${constraint}"`);
  if (promptLabel) console.log(`prompt:     ${promptLabel}`);
  console.log(`entities:   ${entities.length}\n`);

  const ranked = await rankByAssociation(entities, constraint, (r) => {
    if (r.error) console.log(`  ${r.entity.padEnd(20)} ERROR ${r.error}`);
    else if (r.ratio == null) console.log(`  ${r.entity.padEnd(20)} no hits`);
    else console.log(`  ${r.entity.padEnd(20)} ${r.joint}/${r.total} = ${r.ratio.toFixed(5)}`);
  });

  console.log('\nshallow -> deep, with a suggested split:\n');
  for (const r of assignTiers(ranked)) {
    const ratio = r.ratio == null ? '   —   ' : r.ratio.toFixed(5);
    console.log(`  ${(r.tier ?? '?').padEnd(10)} ${ratio}  ${r.entity}`);
  }

  console.log('\nThis is a FIRST DRAFT, correlation +0.63 against measured recall.');
  console.log('It systematically misplaces prototypical members (ostrich reads as');
  console.log('deep because nearly all writing about ostriches is about birds).');
  console.log('No `tooclever` tier is assigned — that one is editorial by nature.');
  console.log('Read the header before trusting the output.');
}
