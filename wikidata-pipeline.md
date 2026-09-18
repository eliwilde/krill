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

## 4. What IS worth taking from this

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
