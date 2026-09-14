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

The repo is committed and ready. Install the GitHub CLI
(<https://cli.github.com>), then from this folder:

```
gh auth login
gh repo create strata --public --source=. --push
gh api -X POST repos/:owner/strata/pages -f "source[branch]=main" -f "source[path]=/"
```

The site lands at `https://<your-username>.github.io/strata/` within a minute
or two. Because it's all static files at the repo root, no build config is
needed. After any future change:

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

700 points is a perfect run: 7,000m, bedrock.

## Prompts

Every prompt is a **factual category with real, finite membership** — "name a
river", "name a chemical element". This matters: rarity only means something
when there's a fact of the matter about which answers are obscure. Opinion
prompts ("name a food that's overrated") break the scoring, because no answer
is objectively rarer than another.

Anything not on any list scores as bedrock (100). The game can't enumerate
every valid answer, and an unrecognised answer is usually genuinely rare. The
tradeoff: nonsense also scores 100. A dictionary check would punish real-but-
obscure answers, which is the opposite of the point.

### Adding prompts

40 prompts ship, which is about 5 runs before repeats. Append to `prompts.js`:

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
| `prompts.js` | The prompt bank — the thing you'll want to edit |
| `game.js` | Scoring tiers, answer matching, strata markers |
| `main.js` | Canvas world, game flow, timer |

## Notes

- Answer matching is loose: articles stripped, case and punctuation ignored,
  crude plural trim. "The Ramen", "ramens" and "ramen" all match.
- Seen prompts persist in `localStorage` so repeats come last. Cleared site
  data resets it; private windows won't persist it, which the code handles.
- Keyboard playable throughout; Enter submits.
- `prefers-reduced-motion` stops the shake, bob, and drifting dust.
