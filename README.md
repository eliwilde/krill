# Scarce

A rarity-scoring quiz game. Seven prompts, 25 seconds each, name one thing — the
rarer your answer, the further your signal carries. Unlimited runs.

## Running it

It's plain ES modules, so it needs to be served rather than opened as a file
(browsers block module imports over `file://`):

```
cd path/to/krill
python -m http.server 8000
```

Then open <http://127.0.0.1:8000>. No build step, no dependencies, no network
calls beyond the Google Fonts stylesheet.

## Files

| File | What it holds |
|------|---------------|
| `index.html` | Markup and all styling |
| `prompts.js` | The prompt bank — the thing you'll want to edit |
| `game.js` | Scoring, answer matching, round assembly |
| `main.js` | Screen flow, timer, the oscilloscope |

## Scoring

Each answer lands in one of three bands:

- **Crowded** (+15) — matched the prompt's `common` list
- **Some noise** (+45) — matched the `mid` list
- **Clear air** (+100) — matched neither

That last rule is deliberate. The game can't possibly enumerate every valid
answer, so anything it doesn't recognise is treated as rare. It's a game about
finding the thing nobody else said, and an unrecognised answer is usually
exactly that. The tradeoff is that nonsense also scores well — there's no
dictionary check, and adding one would punish obscure-but-real answers, which
is the opposite of the point.

Matching is loose: leading articles are stripped, case and punctuation ignored,
and a crude plural trim is applied, so `"A Spoon"`, `"spoons"` and `"spoon"` all
match the same entry.

## Adding prompts

This is the part that keeps the game from going stale. Append to the array in
`prompts.js`:

```js
{ q: "Name something that only exists in airports", tags: ["place"],
  common: ["duty free", "jet bridge"],
  mid: ["moving walkway", "currency exchange"] },
```

Only `q` is strictly required — a prompt with empty `common`/`mid` lists just
scores everything as rare. Aim for 4–6 entries in `common` (the answers most
people blurt out) and 5–8 in `mid` (the second-thought answers). Getting
`common` right matters most: those are the ones the game needs to deflate.

## Repeat avoidance

Finished prompts are recorded in `localStorage` under `scarce.seen`, and each
new run draws from the unseen pool first. Once you've worked through the whole
bank it starts reusing, so the practical fix for repetition is more prompts.
The last 120 are kept. Clearing site data resets it; private windows won't
persist it at all, which the code handles.

## Notes

- Keyboard-only playable; Enter submits.
- `prefers-reduced-motion` slows the waveform to a near-still trace.
- The waveform amplitude tracks your typing — it's an input indicator, not decoration.
