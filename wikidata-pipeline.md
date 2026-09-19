# Wikidata + pageviews as a prompt pipeline — what works and what doesn't

Tested against the live Wikidata Query Service and the Wikimedia Pageviews API
on 2026-09-18, using "European country that is landlocked" as the case study.

**Verdict: use Wikidata for the answer SET, do not use pageviews for the TIERS.**
The first half works well and is worth building. The second half does not survive
contact with the data.

---

## 1. The query, corrected

Three bugs in the original:

```sparql
?country wdt:P47wd:Q123480 .    # missing space — parse error
```

`P47` is **"shares border with"**, not a landlocked qualifier. Even spaced
correctly, `wdt:P47 wd:Q123480` asks for countries bordering *the concept*
"landlocked country", which matches nothing. The property wanted is `P31`
(instance of). Also `?country wdt:P31/wdt:P279* wd:Q6256` combined with
`GROUP_CONCAT` over `skos:altLabel` needs the label service inside the group or
aliases multiply.

Corrected:

```sparql
SELECT ?country ?countryLabel
       (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases)
WHERE {
  ?country wdt:P31 wd:Q123480 .          # instance of: landlocked country
  ?country wdt:P30 wd:Q46 .              # continent: Europe
  OPTIONAL { ?country skos:altLabel ?alias . FILTER(LANG(?alias) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?country ?countryLabel
ORDER BY ?countryLabel
```

## 2. It returns 16 — but not the 16 in the table

| Returned by Wikidata, absent from the table | In the table, absent from Wikidata |
|---|---|
| Kazakhstan | **Andorra** |
| Transnistria | **Armenia** |
| Sovereign State of the Bektashi Order | **Liechtenstein** |

**Andorra, Armenia and Liechtenstein are not tagged `landlocked country`** in
Wikidata. Luxembourg and Switzerland are. The tagging is simply inconsistent.

That matters more than a tidy 16/16: the pipeline silently drops the intended
100-point prize (Liechtenstein) and two of the three Deep Cuts, while adding a
Bektashi Sufi micro-enclave nobody will ever type.

Trying to avoid the tag with geometry fails the other way. Filtering for
sovereign states with no `P206` (located next to body of water) returns
**Iceland, Ireland and the United Kingdom** as landlocked, because P206 is not
populated for them.

**Conclusion:** query Wikidata for a *candidate* set, then verify by hand. Do not
treat any single property as ground truth. The correct European list is 14
(Andorra, Austria, Belarus, Czech Republic, Hungary, Kosovo, Liechtenstein,
Luxembourg, Moldova, North Macedonia, San Marino, Serbia, Slovakia, Switzerland,
Vatican City — 15 counting Kosovo and Vatican City as sovereign), with Armenia
and Kazakhstan depending on where you place the Europe/Asia boundary. That
judgement call is exactly what no query can make for you.

## 3. Pageviews do NOT support the proposed tiers

Trailing 12 months, en.wikipedia, user traffic only (excludes bots — the
`/user/` segment matters, `/all-agents/` inflates small articles badly):

| # | Country | Pageviews | Assigned tier |
|---|---|---|---|
| 1 | Czech Republic | 3,328,579 | Schooler |
| 2 | Switzerland | 2,868,192 | Plankton |
| 3 | Armenia | 2,275,445 | Rare |
| 4 | Serbia | 2,102,599 | Schooler |
| 5 | Hungary | 2,095,589 | Schooler |
| 6 | Kosovo | 2,083,498 | Deep Cut |
| 7 | Belarus | 2,034,485 | Schooler |
| 8 | Austria | 1,943,303 | Plankton |
| 9 | **Liechtenstein** | **1,731,692** | **Krillion (100 pts)** |
| 10 | Luxembourg | 1,692,526 | Too Clever |
| 11 | Slovakia | 1,571,951 | Rare |
| 12 | North Macedonia | 1,569,194 | Rare |
| 13 | Andorra | 1,487,964 | Deep Cut |
| 14 | Vatican City | 1,468,868 | Too Clever |
| 15 | Moldova | 1,406,859 | Rare |
| 16 | San Marino | 1,163,590 | Deep Cut |

Mean pageviews per tier, which should fall monotonically if pageviews drive
tiering:

```
Plankton    2,405,747
Too Clever  1,580,697
Schooler    2,390,313   <-- as high as Plankton
Rare        1,705,862
Deep Cut    1,578,350
Krillion    1,731,692   <-- higher than Too Clever
```

It is not monotonic, and it is not close. Czech Republic outranks Switzerland.
Liechtenstein — the curated top prize — sits 9th of 16, above Luxembourg and
Vatican City, both of which were assigned far shallower tiers.

### Why pageviews fail here, specifically

**The whole range is 1.16M–3.33M, under 3×.** Every European country is a
well-known country. Pageviews measure *article traffic* — driven by news cycles,
football fixtures, travel seasons and diaspora — not *"would you say this when
asked to name a landlocked country in 25 seconds."* Armenia's 2.28M reflects
Nagorno-Karabakh coverage, not top-of-mind geography recall.

This is the same trap documented at the top of `audit-tiers.js`: near-everyone
knows "jupiter", and it is still the wrong answer for "name a moon". Frequency
answers a different question than the game asks.

### What the game already uses instead

`norms-prompts.js` is built on **category production norms** (Banks & Connell
2022; Battig & Montague 1969): participants were asked to *name as many members
of a category as they could*, and the answer's frequency in those responses IS
the rarity signal. That measures recall order directly — the thing being scored.

For a prompt with no production-norm data, the honest fallback is editorial
judgement audited against prevalence, which is what `prompts.js` and
`npm run audit` already do.

## 3b. The revised sea-filter query: worse, and the reason matters

The follow-up proposal replaced the landlocked tag with a geometric filter —
exclude any country bordering a sea:

```sparql
FILTER NOT EXISTS {
  ?country wdt:P47 ?waterBody .
  ?waterBody wdt:P31/wdt:P279* wd:Q15324 .
}
```

**Returns 51 countries**, including Iceland, Malta, Cyprus, Greece, Norway,
Portugal and the United Kingdom. Worse than the 16 it replaced.

`P47` is "shares border with", and it is used for **land** neighbours. Iceland's
P47 is `Greenland, Faroe Islands, Svalbard` — all landmasses, no sea. So the
`FILTER NOT EXISTS` finds no sea to exclude on and passes everything through.

Substituting `P206` ("located next to body of water") does not fix it either:
only **31 of 51** European sovereign states have `P206` populated at all, so the
other 20 read as landlocked by default.

**The general lesson, which applies to any Wikidata pipeline:** absence of a
statement is not absence of the fact. `FILTER NOT EXISTS` over crowd-sourced
data silently converts "nobody has recorded this yet" into "this is false". Any
query built on a negation needs a populated-ness check first:

```sparql
# At minimum, require the property to exist before trusting its absence:
?country wdt:P206 ?anyWater .     # only reason about countries that HAVE data
```

## 4. Tiering: PMI works. This is the good idea.

The co-occurrence-ratio proposal is **correct**, measurably better than
pageviews, and now implemented in [pmi-tier.js](pmi-tier.js).

Measure the ratio, not the count:

```
P(constraint | entity) ~ hits("entity" AND constraint) / hits("entity")
```

The reasoning in the proposal holds up exactly as stated. Switzerland is written
about for banking, chocolate, neutrality and skiing, so "landlocked" is a small
fraction of its coverage. Liechtenstein has far fewer mentions but a much higher
share of them call out being landlocked. Measured on Wikipedia's search index:

| Country | joint/total | ratio |
|---|---|---|
| Austria | 469 / 216,695 | 0.00216 |
| Switzerland | 508 / 224,561 | 0.00226 |
| Czech Republic | 284 / 127,615 | 0.00223 |
| Belarus | 260 / 67,076 | 0.00388 |
| San Marino | 166 / 35,176 | 0.00472 |
| Andorra | 174 / 29,086 | 0.00598 |
| **Liechtenstein** | 214 / 32,380 | **0.00661** |
| Vatican City | 83 / 10,638 | 0.00780 |

Liechtenstein moves from **9th of 16 by pageviews to 15th of 16 by PMI** — i.e.
from "middle of the pack" to "nearly the deepest", which is where the curated
tiering wanted it. That is the proposal working.

### Validated against ground truth: +0.63

Not asserted — tested. 13 birds whose true tiers come from ~460 participants
*actually naming birds* (the category-production norms behind
`norms-prompts.js`), which is precisely what tiering is trying to predict:

```
Spearman correlation, PMI order vs measured recall order:  +0.63
```

Real signal, and clearly better than pageviews. But not a replacement for
measured data, and the failure mode is systematic:

| Word | PMI rank (of 13) | Measured tier |
|---|---|---|
| osprey | 2nd shallowest | **deep** |
| ostrich | 12th (near deepest) | **common** |

**PMI confuses "defined by the category" with "hard to think of".** Nearly
everything written about an ostrich is about it being a bird, so its ratio is
high — but everyone can name one. Prototypical members of a category get
misplaced as deep. Expect to fix those by hand.

(Osprey fails for a different, dumber reason: it is also a backpack brand and a
military aircraft, which dilutes the denominator. Homonyms break this metric.)

### Land area: same monotonicity break, plus a real flaw

Tested too. Ranking by land area is non-monotonic against the proposed tiers,
and it gets the head of the list wrong: **Belarus is the largest landlocked
European country at 207,600 km² and is not the first one people name.** Physical
footprint predicts map salience, not recall. Correlation with PMI is +0.76, so
it is measuring something related, but where they disagree PMI is the better
guide.

### The `tooclever` tier cannot be computed, by any metric

Worth stating plainly, because it explains every monotonicity failure in this
document. In all three metrics tested — pageviews, PMI, land area — the **only**
tier that broke monotonic ordering was Too Clever:

```
PMI:        Plankton 0.00221 -> Too Clever 0.00592 -> Schooler 0.00287  (break)
Land area:  Plankton  62,582 -> Too Clever   1,293 -> Schooler 116,965  (break)
```

Remove Too Clever and PMI is perfectly monotonic across the other five tiers.

That is not a defect in the metric. `tooclever` means *"the answer that feels
like a clever dodge, which thousands of other players also thought was clever"*.
It is a fact about how players reason under time pressure, not about how often
two words co-occur. No corpus statistic can find it, and `pmi-tier.js`
deliberately does not assign it.

## 4b. Live percentile recalibration: right instinct, one trap

"Switch to a running percentile rank once the first 1,000 real players submit"
is the correct long-term answer — player submissions ARE category-production
norms, gathered continuously and for free, which is strictly better data than
any corpus proxy. Worth building.

Two things to get right, though:

**It is a feedback loop, not a measurement.** Players only submit answers the
game rewards. Once `khao soi` is known to pay 85, it gets typed more, its
percentile rises, and it is demoted — and the demotion makes it pay less, so it
gets typed less again. Tiers oscillate, and a player's score depends on when they
played. Mitigation: freeze a day's tiers at round start (the Wordle model — the
puzzle is identical for everyone that day) and recalibrate on a slow cadence from
a held-out sample, not from the live scoring stream.

**Autocomplete has the same problem, worse.** Querying search suggestions for
`european landlocked countries ...` reflects what people *search*, which is
heavily shaped by what listicles and quiz sites already published — and if this
game gets popular, by the game itself. It is also not a stable API, is
geo-personalised, and is against Google's ToS to scrape. If you want a
top-of-mind proxy, PMI is defensible and reproducible; autocomplete is neither.

**The cheap version that works now:** log every submission with the prompt and
the tier awarded. That is the seed corpus for real production norms, costs almost
nothing, and needs no scoring changes. Revisit percentile tiering when a prompt
has a few thousand real submissions.

### Built: submission-log.js + day freeze

[submission-log.js](submission-log.js) now records every submission. Row shape:

```json
{"v":1,"at":"2026-09-18T23:20:17.303Z","session":"668583a3-63a1-4e15",
 "day":"2026-09-18","prompt":"Name a bird","closed":false,"gate":"hinted",
 "idx":0,"raw":"robin","tier":"surface","pts":10,"corrected":null,"ms":900}
```

Design rules, all load-bearing:

- **Raw input, un-coerced.** `cornia`, `wisk`, `zues`, `teepee` and `poly` were
  every bug found from play. Normalised input would have hidden all of them.
- **Never blocks the round.** Logged *after* `setState`, so the verdict is
  already on screen. Every failure is swallowed; a dead endpoint or full quota
  costs the player nothing.
- **Logs what the scorer decided, not what it should have.** A row with
  `tier:"none"` and a correct-looking answer is the bug report.
- **`ms` is retrieval difficulty.** Already visible in testing: `robin` 900ms vs
  `hoatzin` 14,000ms. Measured from a monotonic clock so a system time change
  cannot produce a negative reading.
- **`day` groups rows by frozen day**, so recalibration compares like with like.
- No endpoint configured yet (this deploys as static assets with no Worker), so
  rows buffer in localStorage — capped at 4,000 rows / ~780KB of a 5MB budget,
  oldest dropped first. `configureLog({endpoint:'/api/log'})` drains them to a
  collector via `sendBeacon`, falling back to `fetch(keepalive)`. Nothing else
  changes when that happens.
- `configureLog({enabled:false})` opts out entirely. Session ids are per page
  load and never persisted — there is no cross-session tracking.

**Day freeze** is in `game.js` as `buildDailyRound(date)`: a seeded shuffle
(mulberry32 over an FNV-1a hash of the UTC date) so every player gets the same
seven prompts for a day, with no server and no fetch. Verified deterministic
across times of day, and over 60 days it uses 121 of 125 prompts. Opt-in via
`?daily` — the endless mode is what the game currently is, and switching it
wholesale is a product decision rather than a bug fix.

## 5. What IS worth taking from this

**Aliases.** This is the strongest part of the proposal and it addresses a real
bug class. `skos:altLabel` gives free, well-maintained alias sets:

```
Czech Republic  -> Czechia, Czech Rep.
North Macedonia -> Macedonia, FYROM, Republic of North Macedonia
Vatican City    -> Holy See, Vatican City State, The Vatican
Belarus         -> Belorussia, White Russia
Switzerland     -> Swiss Confederation, Helvetia
```

That is exactly the class of bug reported from real play: `rd` for "road",
`gantt` for "gantt chart", `teepee` missing while `wigwam` was listed. Alias
lists fix those properly, and a player typing "Czechia" should never score zero.

**Suggested shape** — aliases live in the same tier as their canonical form, so
they are never a route to a deeper score:

```js
{ q: "Name a landlocked country", cat: "geo", closed: true,
  surface: ["switzerland", "swiss confederation", "austria", ...],
  ...
  aliases: { "czechia": "czech republic", "fyrom": "north macedonia" } }
```

## 5. API notes for whoever automates this

- **User agent is mandatory.** Both APIs return 403 without a descriptive
  `User-Agent` including contact info. WDQS enforces this strictly.
- **Pageviews: use `/user/`, not `/all-agents/`.** Bot traffic swamps
  low-traffic articles and would scramble any ranking built on it.
- **WDQS has a 60s timeout** and rate limits unauthenticated clients. Cache
  results to a file; do not query at build time, let alone at runtime.
- `wdt:` is truthy-only. Use `p:`/`ps:`/`pq:` if you need deprecated or
  qualified statements (e.g. historical borders).
- Wikidata is crowd-edited and **changes under you**. Any generated list must be
  committed as a snapshot, not re-fetched, or prompts will silently shift.
