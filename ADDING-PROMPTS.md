# Adding and removing prompts

The whole workflow is two commands:

```bash
node prompt-schema.js     # validate: did I declare everything?
npm test                  # verify: does scoring still hold?
```

## Growing the bank: start with measured categories

Before hand-writing a prompt, check whether the category is one the production
norms already cover. **51 usable categories are sitting unused**, and a prompt
built from them arrives with tiers derived from how ~20 people actually
responded — not from anyone's guess about what sounds obscure.

```bash
npm run candidates        # rank unused norm categories by fitness
npm run candidates -- --all   # include ones already in the bank
```

A category is only usable if it has **both** halves of the shape:

| Half | Why | Threshold |
|---|---|---|
| **Consensus** — someone blurts the obvious answer | The first move has to feel like a move. `artistic movement` fails: its top answer got 4 of 20. | top answer named by ≥45% |
| **Tail** — answers almost nobody says | This is the entire reward loop. `prime number` fails: 22% tail, and the members are 2, 3, 5, 7. | ≥35% named by exactly one person |
| **Size** — enough to fill five tiers | Below this the proportional split is meaningless. | ≥24 distinct answers |

To add one, put it in the `USE` table in [build-prompts.js](build-prompts.js)
and rebuild. Tiers are assigned by rank position, not by hand.

The scorer judges **mechanical** suitability only. It cannot tell you whether a
prompt is interesting, or whether its category boundary is clear enough to
score fairly — `personal quality` scores well and would still make a poor
prompt, because players cannot tell a wrong answer from an unlisted one. Read
the list; do not take the top N.

Hand-writing a prompt is the fallback for categories the norms do not cover
(closed sets, proper nouns, anything invented since 2022) — not the default.

`npm run build` and `npm run deploy` both run the tests first and refuse to
ship if they fail.

---

## The one decision that matters: `closed`

Every prompt **must** declare `closed`. The validator rejects it otherwise,
because getting this wrong is the difference between "gibberish pays points"
and "correct answers score zero".

```js
{ q: "Name a Greek letter", cat: "words", closed: true,
  surface: [...], tooclever: [...], common: [...], good: [...], deep: [...] }
```

**`closed: true`** — the list *is* the category. 24 Greek letters, 50 state
capitals, 12 South American countries. Anything not listed is **wrong** and
scores 0.

> Ask yourself: *if a player names something real that I forgot, is it fair to
> give them zero?* If the answer is no, the prompt is not closed.

**`closed: false`** — the category has a long real tail the list cannot cover.
Bird, fruit, phobia, knot. An unlisted answer that passes the **gate** scores
UNCHARTED (8) — deliberately below every measured tier, because an answer the
game cannot check must never outscore one it can.

```js
{ q: "Name a type of knot", cat: "culture", closed: false, gate: "wordlike",
  surface: [...], ... }
```

## Picking a gate (open prompts only)

The gate decides whether an unlisted guess is a real answer or a keyboard mash.
It only ever runs *after* a guess failed to match every listed answer.

| Gate | Use for | How it judges |
|---|---|---|
| `wordlike` | **The default.** Ordinary noun categories: bird, fruit, tool, phobia | Real word in the lexicon → yes. Otherwise must look like an English word. |
| `hinted` | Categories with strong word endings: bird, fish, plant, mineral | As `wordlike`, but an *unknown* single word must also match the category's `hint` suffixes. |
| `lenient` | **Proper nouns and titles**: Pixar characters, former countries, straits, math symbols | Shape only — a lemma list cannot contain "yugoslavia" or "wall-e". |

With `hinted`, also set `hint` to a key from `SUFFIX_HINTS` in
[prompt-schema.js](prompt-schema.js):

```js
{ q: "Name a bird", cat: "norms", closed: false, gate: "hinted", hint: "bird", ... }
```

If you omit `gate` on an open prompt you get `wordlike` and a warning. That is
a safe default, not an error.

## Aliases

When one answer has several accepted spellings, use an alias map. The alias
resolves to its canonical form **before** tier matching, so it scores exactly
what the real answer scores — never zero, never more.

```js
aliases: { "czechia": "czech republic", "drywall": "plasterboard" }
```

Use it for: abbreviations (`rd` → `road`), US/UK pairs (`eggplant` → `aubergine`
— the norms bank is UK-sourced, so this comes up a lot), former names
(`swaziland` → `eswatini`), and alternate forms (`holy see` → `vatican city`).

Two rules, both learned by breaking them:

1. **Never alias a word that is already a listed answer.** `pants` and `sweater`
   are both listed for clothing; aliasing them overwrote their own correct tiers.
   Enforced automatically — bad aliases are dropped and the tests report it.
2. **Check the tier you resolve into.** `sneakers` → `trainers` is a true synonym
   pair, but `trainers` sits at `deep`, so the alias would pay 85 for an everyday
   word. Ask: *would a typical player have earned this tier by naming this?*

Aliases for the generated `norms-prompts.js` go in the `ALIASES` table in
[game.js](game.js), next to `REJECTS`, because that file is regenerated.

`node prompt-schema.js` errors if an alias points at an answer that isn't listed.

## Rejects

For open prompts, list the wrong-category answers players actually type. These
live in `REJECTS` in [game.js](game.js) (keyed by prompt text) because
`norms-prompts.js` is generated and would lose hand edits:

```js
'Name a fish': ['whale', 'dolphin', 'squid', 'octopus', 'crab'],
```

## Removing a prompt

Delete the object. Then check `RIVALS` and `REJECTS` in [game.js](game.js) for
entries keyed to its text, and run `npm test`.

---

## Two things the tests will not let you do

**1. Fuzzy-match listed answers.** Scoring is exact, deliberately. Typo
tolerance applied to the bank merges 54 pairs of answers that sit in *different
tiers* — `mebibyte`/`tebibyte`, `epsilon`/`upsilon`,
`acrophobia`/`aerophobia`, `east germany`/`west germany`. Every one is a real,
distinct answer worth a different score, and they are 1 edit apart, so no
tighter budget fixes it. The categories this game is built on are exactly the
ones whose members are minimal pairs. `npm test` prints the current list.

**2. Let the lexicon reject an answer.** It only ever *promotes*. Its gaps are
real — `pierogi`, `mangosteen` and `jabuticaba` are absent and all correct — so
a word it does not know falls through to the shape check rather than being
thrown out. Rejecting a real obscure answer is the worst failure this game has.

## Where tiers come from (unchanged)

Correctness and tiering are separate jobs, and this doc is only about
correctness. Tiers come from:

- **`norms-prompts.js`** — *measured*. How many of ~20 participants named this
  answer when asked to list the category in 60 seconds. Generated by
  `build-prompts.js`; do not hand-edit.
- **`prompts.js`** — editorial judgement, audited against word-prevalence norms
  by `npm run audit`.

Word *frequency* answers "how common is this word", which is a different
question from "is this a correct answer". Everyone knows "jupiter"; it is still
wrong for "name a moon". See the header of [audit-tiers.js](audit-tiers.js).

## Regenerating the lexicon

Only needed if `prevalence.tsv` changes:

```bash
npm run lexicon
```

The browser cannot read the 1MB TSV, so `lexicon.js` (520 KB, 51,127 lemmas) is
generated for it. `build.js` fails if it is missing and warns if it is stale.
