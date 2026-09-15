# Strata

A rarity-scoring quiz game. Seven factual prompts per run, 25 seconds each —
name one thing that fits. The rarer your answer, the deeper you dig. Unlimited
runs.

## Running it locally

Plain ES modules, so it needs to be served (browsers block module imports over
`file://`):

```
python -m http.server 8000
```

Then open <http://127.0.0.1:8000>. No build step, no dependencies.

## Publishing to GitHub Pages

The repo lives at `eliwilde/krill` on the `krill` branch. Enable Pages once,
in **Settings → Pages → Source: deploy from branch `krill`, folder `/`**, or
from the CLI:

```
gh api -X POST repos/eliwilde/krill/pages -f "source[branch]=krill" -f "source[path]=/"
```

The site lands at <https://eliwilde.github.io/krill/> within a minute or two.
Because it's all static files at the repo root, no build config is needed.
After any future change:

```
git add -A && git commit -m "your message" && git push
```

## The scoring

Six tiers, shallowest to deepest:

| Tier | Points | What it means |
|------|--------|---------------|
| Topsoil | 10 | The answer everyone blurts out |
| Too clever | 15 | The one you felt smart for — so did everyone |
| Clay | 30 | Solidly known |
| Shale | 60 | Most people wouldn't reach it |
| Fossil bed | 85 | Genuinely obscure |
| Bedrock | 100 | Not on any list |

**Too clever is the point of the game.** For "name a noodle dish", ramen is
topsoil and pho is *too clever* — it feels like a deep cut but thousands of
players reach for it second. Scoring it below the obvious answer is what makes
the game more than trivia.

700 points is a perfect run: **35,876 ft — the Challenger Deep**.

### Depth is exponential, and measured in feet

Score maps to depth through `depthFor()` in `game.js`:

```
depth(score) = A * (e^(k·score/700) − 1)      k = 7, A = 35876/(e^7 − 1)
```

Not a straight line, because a straight line can't be honest here. Real buried
things are *shallow* — a Roman road at 13ft, a Clovis point at 30ft — while the
floor of the world is 35,876ft down. Spread linearly, every artifact worth
naming would sit inside the first 0.1% of the shaft.

The curve gives the shallow end real resolution and still reaches the trench:

| Cumulative score | Depth | |
|---|---|---|
| 10 (one topsoil) | 3 ft | medieval pottery |
| 70 (all topsoil) | 33 ft | a deep trench |
| 210 (all clay) | 235 ft | |
| 420 (all shale) | 2,151 ft | |
| 700 (perfect) | 35,876 ft | Challenger Deep |

Each answer digs roughly 2.7× further than the last, which is also better
drama — the shaft opens slowly and ends in freefall.

The world is drawn in **log space** for the same reason (`depthToY()` in
`main.js`), so a dig always *looks* like the same size leap wherever it starts.

### What you dig past

`STRATA` in `game.js` is the list of things you pass on the way down, each at
the depth you would *really* pass it. Nothing is invented for effect. Artifacts
are revealed only once the digger has actually reached them.

| Depth | | Why that depth |
|---|---|---|
| 3 ft | medieval pottery sherd | typical medieval layer, ~0.87m+ below surface |
| 13 ft | Roman road | Roman deposits under later occupation |
| 30 ft | Clovis point in mammoth bone | Clovis kill sites |
| 60 ft | mammoth in permafrost | Siberian permafrost finds |
| 12,500 ft | the Titanic | wreck depth in the N. Atlantic |
| 12,766 ft | Mponeng | deepest mine ever dug |
| 35,876 ft | Challenger Deep | the floor of the world |

Kola (40,230 ft) is deliberately absent — it is *deeper* than Challenger Deep,
so it sits below the floor of the game.

Sources: [medieval/Roman stratigraphy](https://sevenswords.uk/how-deep-are-archaeological-remains-buried/),
[Challenger Deep](https://en.wikipedia.org/wiki/Challenger_Deep),
[Titanic](https://www.britannica.com/topic/How-Deep-Is-the-Titanic-Wreck),
[Mponeng](https://en.wikipedia.org/wiki/Mponeng_Gold_Mine),
[Kola](https://en.wikipedia.org/wiki/Kola_Superdeep_Borehole).

## Prompts

Every prompt is a **factual category with real, finite membership** — "name a
river", "name a chemical element". This matters: rarity only means something
when there's a fact of the matter about which answers are obscure. Opinion
prompts ("name a food that's overrated") break the scoring, because no answer
is objectively rarer than another.

Anything not on any list scores as bedrock (100). The game can't enumerate
every valid answer, and an unrecognised answer is usually genuinely rare. There
is deliberately **no dictionary check** — that would punish real-but-obscure
answers, which is the opposite of the point.

What the game does reject, scoring 0, is the *obviously wrong* answer: input
that isn't an answer at all (under 3 characters, pure digits, no vowels), the
prompt's own subject word, and answers that are listed under a different
prompt — "ramen" typed at "name a cheese" is a real word in the wrong
category. Cross-referencing the whole bank catches those without a dictionary.

### Where the tiers come from

Two halves. `prompts.js` is hand-written — my judgement of what people commonly
answer. `norms-prompts.js` is **generated from measured human responses** by
`build-prompts.js`, which merges two academic category-production studies:

| Source | Sample | Categories | Notes |
|--------|--------|-----------|-------|
| [Battig & Montague (1969)](https://cran.r-project.org/src/contrib/Archive/WordPools/) | ~440 US | 56 | 5231 words, pre-filtered to freq > 1 |
| [Banks & Connell (2022)](https://osf.io/jgcu6/) | ~20 UK | 117 | Modern, broader, long singleton tail |

In both, participants were asked to name as many members of a category as they
could against a clock. How many people said each answer *is* the rarity signal
the game scores on — so those tiers are measured rather than guessed. Merging
the two roughly doubles coverage and lets agreement between samples taken 50
years apart on different continents act as evidence an answer is real.

Licences differ: Banks & Connell is CC-BY 4.0, WordPools is GPL-2. That matters
if you ever license Strata itself.

Rebuild after changing a source or the tuning:

```
node build-prompts.js
```

### The closed-set rule

Every hand-written prompt is a **closed set** — one whose full membership is
small enough that ~30 entries genuinely covers it: 24 Greek letters, 50 state
capitals, 12 South American countries, 9 parts of speech.

That isn't a style preference, it's what keeps the scoring honest. Bedrock is
meant to mean *you found something nobody else did*. On an open set — cheese
(~1800 real answers), cocktail (~600), chess opening (~1300) — a 30-entry list
covers 2–5%, so nearly every correct answer is unlisted and bedrock fires
constantly. It stops being a reward and becomes the default.

Open-set prompts were removed for exactly that reason. The ones that remain are
either closed sets or backed by measured response data.

Before adding a prompt, ask: *could this list plausibly hold most of the real
answers?* If not, it belongs in `norms-prompts.js` or nowhere.

### Adding prompts

79 prompts ship, which is about 11 runs before repeats. Append to `prompts.js`
(hand-written prompts only — `norms-prompts.js` is generated, don't edit it):

```js
{ q: "Name a volcano", cat: "geo",
  surface: ["vesuvius", "mount st helens", "krakatoa"],
  tooclever: ["etna", "fuji", "kilauea"],
  common: ["popocatepetl", "mauna loa", "stromboli"],
  good: ["cotopaxi", "erebus", "pinatubo"],
  deep: ["ojos del salado", "nyiragongo", "tambora"] },
```

Only `q` is required. Getting `surface` and `tooclever` right matters most —
those are the two tiers the game exists to deflate.

## Files

| File | What it holds |
|------|---------------|
| `index.html` | Markup and styling |
| `prompts.js` | Hand-written prompt bank — the thing you'll want to edit |
| `norms-prompts.js` | **Generated** from the studies below; don't edit by hand |
| `build-prompts.js` | Regenerates the above from the source datasets |
| `game.js` | Scoring tiers, answer matching, strata markers |
| `main.js` | Canvas world, game flow, timer |

The two CSVs and `battig-raw.json` are the raw source data. The game never
reads them — only `build-prompts.js` does.

## Notes

- Answer matching is loose: articles stripped, case and punctuation ignored,
  crude plural trim. "The Ramen", "ramens" and "ramen" all match.
- Seen prompts persist in `localStorage` so repeats come last. Cleared site
  data resets it; private windows won't persist it, which the code handles.
- Keyboard playable throughout; Enter submits.
- `prefers-reduced-motion` stops the shake, bob, and drifting dust.
