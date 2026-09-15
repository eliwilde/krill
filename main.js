import { buildRound, scoreAnswer, deeperExamples, depthFor, STRATA, CONFIG } from './game.js';

const { SECONDS, ROUND_LENGTH, BEDROCK } = CONFIG;

/** Feet, with thousands separators. 3 -> "3 ft", 35876 -> "35,876 ft". */
const ft = (n) => `${Math.round(n).toLocaleString()} ft`;

const stage   = document.getElementById('stage');
const elDepth = document.getElementById('depth');
const elScore = document.getElementById('score');
const elPips  = document.getElementById('pips');
const elStrat = document.getElementById('stratum');

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================= state */

let state = {
  screen: 'intro',
  round: [], index: 0, score: 0, log: [],
  seen: load(),
};

function setState(next) {
  state = { ...state, ...next };
  render();
}

function load() {
  try { return JSON.parse(localStorage.getItem('strata.seen') ?? '[]'); }
  catch { return []; }
}
function save(list) {
  try { localStorage.setItem('strata.seen', JSON.stringify(list.slice(-160))); }
  catch { /* private window — variety just resets */ }
}

/* ============================================================== the world
 * A side-on shaft. The camera follows the digger down as score rises.
 * Everything is drawn procedurally — no image assets to load. */

const cvs = document.getElementById('world');
const ctx = cvs.getContext('2d');

let camY = 0;          // metres at top of viewport
let targetY = 0;       // where the camera is heading
let diggerY = 0;       // digger's depth in metres
let targetDig = 0;
let shake = 0;
let t = 0;

/* Deterministic pseudo-random so the rock texture doesn't boil between
   frames — same depth always produces the same speckles. */
function rnd(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function size() {
  const r = Math.min(devicePixelRatio || 1, 2);
  cvs.width = innerWidth * r;
  cvs.height = innerHeight * r;
  ctx.setTransform(r, 0, 0, r, 0, 0);
}
size();
addEventListener('resize', size);

/* The shaft is drawn in LOG space, not linear.
 *
 * Depth runs from 1ft to 35,876ft. At a linear pixels-per-foot the first
 * thirty feet — where every artifact actually is — would be a single pixel,
 * and the Roman road would be indistinguishable from the topsoil above it.
 * Mapping depth through log10 gives the shallow end room to breathe while
 * still reaching the trench floor, and has the nice second property that a
 * dig always *looks* like the same size leap regardless of where it starts. */
const PX_PER_DECADE = 560;             // screen px per 10x of depth
const LOG_FLOOR = 0;                   // log10(1ft) — the top of the scale

/** Depth in feet -> a continuous world-space y in pixels. */
function depthToY(f) {
  return (Math.log10(Math.max(f, 0) + 1) - LOG_FLOOR) * PX_PER_DECADE;
}

/* Ground colour by depth. Warm browns near the surface, cooling to near-black
   rock, then to the blue-black of deep water at trench depth. */
function bandColour(f) {
  if (f < 3)     return '#6B4423';
  if (f < 10)    return '#5F3D20';
  if (f < 30)    return '#7A4A28';
  if (f < 80)    return '#55361D';
  if (f < 250)   return '#4A2F1B';
  if (f < 800)   return '#3E2A18';
  if (f < 2500)  return '#332316';
  if (f < 8000)  return '#2A1D13';
  if (f < 18000) return '#1C1A1C';
  return '#0E1620';                    // deep water, not soil
}

/* Sprites for the things buried down there. Drawn as chunky pixel art on a
   small grid so they sit with the rest of the art rather than looking like
   clipart. Each is a list of [x, y, w, h, colour] in local pixels. */
const SPRITES = {
  coin:      [[2,2,6,6,'#C9A227'],[3,3,4,4,'#F0CE5A'],[4,4,2,2,'#C9A227']],
  pot:       [[1,3,8,2,'#A6553A'],[2,5,6,4,'#8E4630'],[3,1,2,2,'#A6553A'],[2,5,6,1,'#C46B4A']],
  pipe:      [[1,5,7,1,'#E8DCC4'],[7,3,3,3,'#E8DCC4'],[8,4,1,1,'#3A2C1E']],
  post:      [[2,1,2,9,'#4A3520'],[6,2,2,8,'#4A3520'],[1,0,4,1,'#5C4228'],[5,1,4,1,'#5C4228']],
  road:      [[0,4,10,3,'#8C8378'],[0,4,3,3,'#9C9388'],[4,4,2,3,'#7A7168'],[7,4,3,3,'#9C9388'],[0,7,10,1,'#5E564D']],
  char:      [[0,4,10,3,'#1A1512'],[1,3,3,1,'#2E2622'],[6,3,3,1,'#2E2622'],[3,5,2,1,'#4A2A1A']],
  bronze:    [[2,4,7,2,'#4E7A5C'],[1,6,5,2,'#5E8A6C'],[6,2,2,3,'#4E7A5C']],
  flint:     [[4,1,2,2,'#5A5148'],[3,3,4,3,'#6E655A'],[2,6,6,3,'#5A5148'],[4,2,1,4,'#867C70']],
  bone:      [[1,4,8,2,'#D8CDB4'],[0,3,2,4,'#E8DDC4'],[8,3,2,4,'#E8DDC4'],[4,1,2,3,'#9C8F76']],
  mammoth:   [[1,3,7,5,'#6B4A32'],[0,4,2,3,'#7B5A42'],[0,3,1,1,'#8B6A52'],[2,8,2,2,'#5B3A22'],[5,8,2,2,'#5B3A22'],[8,3,2,1,'#D8CDB4'],[8,5,2,1,'#D8CDB4']],
  ammonite:  [[3,2,4,1,'#8A7A5C'],[2,3,1,4,'#8A7A5C'],[7,3,1,4,'#8A7A5C'],[3,7,4,1,'#8A7A5C'],[4,4,2,2,'#B0A078'],[4,3,3,1,'#6A5C44'],[3,5,1,2,'#6A5C44']],
  coal:      [[0,3,10,4,'#14100E'],[1,2,4,1,'#241E1A'],[6,7,3,1,'#241E1A'],[3,4,2,1,'#2E2622']],
  trilobite: [[2,1,6,2,'#7A6A50'],[1,3,8,4,'#8A7A5C'],[3,7,4,2,'#6A5C44'],[3,3,1,4,'#5A4C36'],[6,3,1,4,'#5A4C36']],
  diamond:   [[4,1,2,1,'#BFE8F0'],[2,2,6,3,'#8FD0E0'],[3,5,4,2,'#BFE8F0'],[4,7,2,2,'#6FB0C8']],
  wreck:     [[0,4,10,3,'#4A4038'],[1,7,8,1,'#3A322A'],[2,1,1,3,'#5A5048'],[6,2,1,2,'#5A5048'],[0,4,10,1,'#6A6058']],
  mine:      [[4,0,2,6,'#7A7168'],[2,6,6,4,'#5E564D'],[3,7,4,2,'#2A241E'],[1,5,8,1,'#8C8378']],
  trench:    [[0,6,10,4,'#060C14'],[0,5,3,1,'#101A24'],[7,5,3,1,'#101A24'],[4,4,2,1,'#1A2A38']],
  grass:     [[0,6,10,4,'#4E6B32'],[1,4,1,2,'#5E7B42'],[4,3,1,3,'#5E7B42'],[7,4,1,2,'#5E7B42'],[0,6,10,1,'#6E8B52']],
};

function drawSprite(name, x, y, scale = 2) {
  const s = SPRITES[name];
  if (!s) return;
  for (const [px, py, pw, ph, col] of s) {
    ctx.fillStyle = col;
    ctx.fillRect(x + px * scale, y + py * scale, pw * scale, ph * scale);
  }
}

function drawWorld() {
  const w = innerWidth, h = innerHeight;
  const sx = shake ? (rnd(t, 1) - 0.5) * shake : 0;
  const sy = shake ? (rnd(t, 2) - 0.5) * shake : 0;
  ctx.save();
  ctx.translate(sx, sy);

  const groundPx = depthToY(0) - camY;   // y-pixel of the surface line
  /** World y (px) -> depth in feet. Inverse of depthToY. */
  const yToDepth = (y) => Math.pow(10, (y + camY) / PX_PER_DECADE + LOG_FLOOR) - 1;

  // --- sky ---------------------------------------------------------------
  if (groundPx > -2) {
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(groundPx, 1));
    g.addColorStop(0, '#9CC2D8');
    g.addColorStop(0.55, '#E3D2A8');
    g.addColorStop(1, '#D9B67E');
    ctx.fillStyle = g;
    ctx.fillRect(-4, -4, w + 8, groundPx + 6);

    // sun, with a soft corona. Sits partway up whatever sky is visible rather
    // than a fixed distance above the horizon, so it never clips off the top.
    const sunX = w - 118;
    const sunY = Math.max(groundPx - 150, Math.min(groundPx * 0.28, 60));
    const halo = ctx.createRadialGradient(sunX + 23, sunY + 23, 4, sunX + 23, sunY + 23, 78);
    halo.addColorStop(0, 'rgba(255,214,130,.55)');
    halo.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 55, sunY - 55, 156, 156);
    ctx.fillStyle = '#FFD782';
    ctx.fillRect(sunX, sunY, 46, 46);
    ctx.fillStyle = '#FFE9B4';
    ctx.fillRect(sunX + 6, sunY + 6, 34, 34);

    // clouds — slow parallax drift, far slower than the dust
    if (groundPx > 40) {
      for (let i = 0; i < 5; i++) {
        const cw = 60 + rnd(i, 21) * 70;
        const cx = ((rnd(i, 22) * (w + 300) + (calm ? 0 : t * 0.12 * (0.4 + rnd(i, 23)))) % (w + 300)) - 150;
        const cy = groundPx - 190 - rnd(i, 24) * 130;
        if (cy < -40) continue;
        ctx.fillStyle = `rgba(255,252,242,${0.5 + rnd(i, 25) * 0.3})`;
        ctx.fillRect(cx, cy, cw, 11);
        ctx.fillRect(cx + 14, cy - 8, cw - 34, 9);
      }
    }

    // far ridge, then a nearer one — depth through overlap
    ctx.fillStyle = '#B08E62';
    for (let i = 0; i < w + 60; i += 30) {
      const hh = 20 + rnd(i, 11) * 30;
      ctx.fillRect(i - 30, groundPx - hh, 30, hh);
    }
    ctx.fillStyle = '#C9A06A';
    for (let i = 0; i < w + 40; i += 40) {
      const hh = 12 + rnd(i, 7) * 20;
      ctx.fillRect(i - 20, groundPx - hh, 40, hh);
    }
    // grass lip on the horizon
    ctx.fillStyle = '#5E7B42';
    ctx.fillRect(-4, groundPx - 4, w + 8, 5);
  }

  // --- the ground --------------------------------------------------------
  // Walk the screen in pixel rows and colour each by the depth it represents;
  // in log space a fixed depth step would bunch at the top and starve at the
  // bottom, so stepping in SCREEN space is what keeps the bands even.
  const STEP = 8;
  const top = Math.max(groundPx, -STEP);
  for (let y = top; y < h + STEP; y += STEP) {
    const f = yToDepth(y);
    ctx.fillStyle = bandColour(f);
    ctx.fillRect(-4, y, w + 8, STEP + 1);
  }

  // texture: grit and pebbles, seeded on a world-space grid so it stays put
  const gridTop = Math.floor((top + camY) / 26) * 26;
  for (let gy = gridTop; gy < camY + h + 26; gy += 26) {
    const y = gy - camY;
    if (y < groundPx - 2) continue;
    for (let i = 0; i < 7; i++) {
      const px = rnd(gy, i) * w;
      const py = y + rnd(gy, i + 50) * 26;
      const sz = 1 + Math.floor(rnd(gy, i + 90) * 3);
      const lit = rnd(gy, i + 30);
      ctx.fillStyle = lit > 0.80 ? 'rgba(255,225,170,.14)'
                    : lit > 0.62 ? 'rgba(0,0,0,.26)'
                                 : 'rgba(0,0,0,.14)';
      ctx.fillRect(px, py, sz, sz);
    }
  }

  // horizontal bedding lines — reads as sedimentary layering, cheaply
  for (let gy = gridTop; gy < camY + h + 60; gy += 60) {
    const y = gy - camY;
    if (y < groundPx) continue;
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.fillRect(-4, y, w + 8, 1);
    ctx.fillStyle = 'rgba(255,220,170,.05)';
    ctx.fillRect(-4, y + 1, w + 8, 1);
  }

  // --- the shaft ---------------------------------------------------------
  const shaftW = Math.min(150, w * 0.34);
  const shaftX = w / 2 - shaftW / 2;
  const topPx = Math.max(groundPx, -10);
  const digPx = depthToY(diggerY) - camY;
  const shaftH = Math.max(digPx - topPx, 0);

  // a gradient down the hole so it reads as receding, not a flat rectangle
  if (shaftH > 0) {
    const sg = ctx.createLinearGradient(shaftX, topPx, shaftX + shaftW, topPx);
    sg.addColorStop(0, '#0A0705');
    sg.addColorStop(0.5, '#171009');
    sg.addColorStop(1, '#0A0705');
    ctx.fillStyle = sg;
    ctx.fillRect(shaftX, topPx, shaftW, shaftH);

    // cut walls, lit on one side
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(shaftX - 3, topPx, 3, shaftH);
    ctx.fillRect(shaftX + shaftW, topPx, 3, shaftH);
    ctx.fillStyle = 'rgba(240,190,110,.10)';
    ctx.fillRect(shaftX, topPx, 2, shaftH);

    // timber shoring every 46px — gives the fall something to measure against
    for (let y = Math.floor(topPx / 46) * 46; y < digPx; y += 46) {
      if (y < topPx) continue;
      ctx.fillStyle = '#4A3520';
      ctx.fillRect(shaftX, y, shaftW, 3);
      ctx.fillStyle = 'rgba(255,220,160,.10)';
      ctx.fillRect(shaftX, y, shaftW, 1);
    }
    // rope
    ctx.fillStyle = '#8A6B3F';
    ctx.fillRect(w / 2 - 1, topPx, 2, shaftH);
  }

  // --- strata: artifacts and layer labels --------------------------------
  for (const s of STRATA) {
    const y = depthToY(s.ft) - camY;
    if (y < -30 || y > h + 30) continue;

    const side = (STRATA.indexOf(s) % 2) === 0;
    const tx = side ? 18 : w - 18;
    const major = s.kind === 'major';
    const find = s.kind === 'find';
    // Only reveal what you have actually dug past. Everything below the
    // digger stays hidden — the descent should uncover things, not list them.
    if (diggerY < s.ft - 0.01) continue;

    // the sprite sits just outside the shaft wall, in the ground
    if (s.icon) {
      const ix = side ? shaftX - 34 : shaftX + shaftW + 14;
      drawSprite(s.icon, ix, y - 10, 2);
    }

    // On a phone there is no room beside the shaft for a line of prose — the
    // labels would run under the verdict copy. Keep the sprites, drop the text
    // for everything but the headline depths.
    if (w < 560 && !major) continue;

    ctx.font = major ? '600 11px "DM Mono", monospace' : '10px "DM Mono", monospace';
    ctx.textAlign = side ? 'left' : 'right';
    // A drop shadow rather than more opacity: the labels sit on busy, varying
    // soil, and raising alpha alone still loses them against the lighter grit.
    ctx.shadowColor = 'rgba(0,0,0,.95)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = major ? 'rgba(255,206,110,1)'
                  : find  ? 'rgba(242,222,186,.92)'
                          : 'rgba(206,184,150,.66)';
    ctx.fillText(s.text, tx, y);

    // depth tag + tick
    ctx.font = '9px "DM Mono", monospace';
    ctx.fillStyle = major ? 'rgba(255,206,110,.85)' : 'rgba(224,196,150,.6)';
    ctx.fillText(ft(s.ft), tx, y + 13);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = major ? 'rgba(255,206,110,.55)' : 'rgba(200,175,135,.3)';
    ctx.fillRect(side ? 18 : w - 66, y + 19, 48, 1);
  }
  ctx.textAlign = 'left';

  // --- the digger --------------------------------------------------------
  if (digPx > -40 && digPx < h + 40) {
    const bob = calm ? 0 : Math.sin(t * 0.06) * 2;
    const dx = w / 2;
    const dy = digPx + bob;

    // lamp glow first, so the cage sits inside it
    const glow = ctx.createRadialGradient(dx, dy, 2, dx, dy, 120);
    glow.addColorStop(0, 'rgba(255,196,96,.34)');
    glow.addColorStop(0.45, 'rgba(240,180,76,.13)');
    glow.addColorStop(1, 'rgba(240,180,76,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(dx - 120, dy - 120, 240, 240);

    // cage
    ctx.fillStyle = '#3A2A18';
    ctx.fillRect(dx - 15, dy - 14, 30, 30);
    ctx.fillStyle = '#F0B44C';
    ctx.fillRect(dx - 14, dy - 13, 28, 3);
    ctx.fillRect(dx - 14, dy - 13, 3, 27);
    ctx.fillRect(dx + 11, dy - 13, 3, 27);
    ctx.fillRect(dx - 14, dy + 11, 28, 3);
    ctx.fillStyle = '#FFD782';
    ctx.fillRect(dx - 14, dy - 13, 28, 1);
    // occupant
    ctx.fillStyle = '#E2663B';
    ctx.fillRect(dx - 5, dy - 7, 10, 11);
    ctx.fillStyle = '#F5C9A8';
    ctx.fillRect(dx - 4, dy - 6, 8, 4);
    ctx.fillStyle = '#F2E8D5';
    ctx.fillRect(dx - 3, dy - 5, 2, 2);
    ctx.fillRect(dx + 1, dy - 5, 2, 2);
    // headlamp
    ctx.fillStyle = '#FFE9B4';
    ctx.fillRect(dx - 1, dy - 8, 3, 2);
  }

  // --- dust motes drifting up -------------------------------------------
  if (!calm) {
    for (let i = 0; i < 30; i++) {
      const seed = i * 13.37;
      const dxp = rnd(seed, 1) * w;
      const span = h + 120;
      const dyp = ((rnd(seed, 2) * span) - (t * (0.25 + rnd(seed, 3) * 0.5)) % span + span) % span;
      const sz = rnd(seed, 5) > 0.82 ? 2 : 1;
      ctx.fillStyle = `rgba(245,210,150,${0.05 + rnd(seed, 4) * 0.15})`;
      ctx.fillRect(dxp, dyp, sz, sz);
    }
  }

  // vignette keeps the centre readable
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.26, w / 2, h / 2, h * 0.92);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.70)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

/* The digger is eased in LOG space, not in feet. Easing the raw footage would
   make a dive from 12,000ft to 35,000ft look like a rocket launch while a dive
   from 3ft to 9ft looked like nothing happened at all — the same visual fall
   should read as the same size event wherever it happens. */
let digLog = 0, targetDigLog = 0;

function loop() {
  t++;
  camY += (targetY - camY) * 0.075;
  digLog += (targetDigLog - digLog) * 0.075;
  diggerY = Math.pow(10, digLog) - 1;
  if (shake > 0) shake *= 0.86;
  if (shake < 0.15) shake = 0;

  // live depth readout tracks the animation, so the number climbs with the fall
  elDepth.textContent = ft(diggerY);
  elStrat.textContent = currentStratum(diggerY);

  drawWorld();
  requestAnimationFrame(loop);
}

function currentStratum(f) {
  let cur = STRATA[0];
  for (const s of STRATA) if (f >= s.ft) cur = s;
  return cur.text.toUpperCase().slice(0, 34);
}

function diveTo(feet) {
  targetDig = feet;
  targetDigLog = Math.log10(Math.max(feet, 0) + 1);
  // Keep the digger around 48% down the viewport. The clamp stops the camera
  // rising so far at the surface that the sky fills the screen — at 0ft we
  // want the horizon high, with the ground occupying most of the frame.
  targetY = Math.max(depthToY(feet) - innerHeight * 0.48, -innerHeight * 0.17);
  shake = calm ? 0 : Math.min(4 + feet / 900, 11);
}

size();
diveTo(0);
camY = targetY; diggerY = 0; digLog = 0;
loop();

/* ================================================================= timer */

let timerId = null;
function stopTimer() { clearInterval(timerId); timerId = null; }

function startTimer(onEnd) {
  stopTimer();
  let left = SECONDS;
  const el = document.getElementById('clock');
  if (el) el.textContent = left;

  timerId = setInterval(() => {
    left--;
    const c = document.getElementById('clock');
    if (c) {
      c.textContent = Math.max(left, 0);
      if (left <= 5) c.classList.add('low');
    }
    if (left <= 0) { stopTimer(); onEnd(); }
  }, 1000);
}

/* ================================================================== flow */

function begin() {
  diveTo(0);
  setState({ screen: 'play', round: buildRound(state.seen), index: 0, score: 0, log: [] });
}

function submit(raw) {
  stopTimer();
  const prompt = state.round[state.index];
  const res = scoreAnswer(prompt, raw);
  const score = state.score + res.pts;
  // On an exponential scale the metres a single answer buys depends on how
  // deep you already were, so the gain is the difference between two depths.
  const from = depthFor(state.score);
  const to = depthFor(score);
  diveTo(to);
  setState({
    screen: 'verdict',
    score,
    log: [...state.log, {
      q: prompt.q,
      answer: String(raw).trim(),
      ...res,
      gained: to - from,
      depth: to,
      // Sampled once, here, so re-renders of the verdict don't reshuffle it.
      deeper: deeperExamples(prompt, res.tier),
    }],
  });
}

function advance() {
  const next = state.index + 1;
  if (next >= state.round.length) {
    const seen = [...state.seen, ...state.round.map((p) => p.q)];
    save(seen);
    setState({ screen: 'done', seen });
  } else {
    setState({ screen: 'play', index: next });
  }
}

/* ================================================================ render */

function updateHud() {
  elScore.textContent = state.score;
  const playing = state.screen === 'play' || state.screen === 'verdict';
  elPips.innerHTML = Array.from({ length: ROUND_LENGTH }, (_, i) => {
    const cls = !playing ? '' : i < state.index ? 'done' : i === state.index ? 'now' : '';
    return `<span class="pip ${cls}"></span>`;
  }).join('');
}

function render() {
  updateHud();
  ({ intro: renderIntro, play: renderPlay, verdict: renderVerdict, done: renderDone })[state.screen]();
}

function renderIntro() {
  stage.innerHTML = `
    <p class="eyebrow">⛏ SEVEN PROMPTS · 25 SECONDS EACH</p>
    <h1 class="prompt">STRATA</h1>
    <p class="intro-copy">
      Name one thing that fits. Obvious answers barely scratch the topsoil.
      The rarer the answer, the deeper you dig — and every answer digs
      <b>exponentially</b> further than the last.
      <b>The clever one you're proud of? Everyone thought of that too.</b>
    </p>
    <p class="intro-foot">A perfect run reaches ${ft(BEDROCK)} — the Challenger Deep.</p>
    <button id="go">START DIGGING</button>
  `;
  document.getElementById('go').onclick = begin;
}

function renderPlay() {
  const p = state.round[state.index];
  stage.innerHTML = `
    <p class="eyebrow">PROMPT ${state.index + 1} OF ${ROUND_LENGTH}</p>
    <p class="clock" id="clock">${SECONDS}</p>
    <h2 class="prompt">${esc(p.q)}</h2>
    <form class="entry" id="f">
      <input type="text" id="answer" autocomplete="off" autocapitalize="off"
             spellcheck="false" placeholder="type one answer…" aria-label="Your answer">
      <button type="submit" id="send" disabled>DIG</button>
    </form>
    <p class="hint">▼ RARER ANSWERS DIG DEEPER ▼</p>
  `;
  const input = document.getElementById('answer');
  const send = document.getElementById('send');
  input.focus();
  input.oninput = () => { send.disabled = !input.value.trim(); };
  document.getElementById('f').onsubmit = (e) => {
    e.preventDefault();
    if (input.value.trim()) submit(input.value);
  };
  startTimer(() => submit(''));
}

function renderVerdict() {
  const last = state.log[state.log.length - 1];
  const isEnd = state.index + 1 >= state.round.length;
  stage.innerHTML = `
    <p class="tier t-${last.tier}">${last.label}</p>
    ${last.answer ? `<p class="said">“${esc(last.answer)}”</p>` : `<p class="said">no answer</p>`}
    <p class="gain">+${last.pts} PTS · DUG ${ft(last.gained)}</p>
    <p class="atdepth">now at ${ft(last.depth)}</p>
    <p class="note">${last.note}</p>
    ${last.deeper?.length ? `
      <div class="deeper">
        <p class="deeper-k">${last.tier === 'unlisted' ? '' : 'DEEPER FROM HERE'}</p>
        <p class="deeper-v">${last.deeper.map(esc).join(' · ')}</p>
      </div>` : ''}
    <div class="rowbtns" style="margin-top:28px">
      <button id="next">${isEnd ? 'SEE THE DIG ▼' : 'KEEP DIGGING ▼'}</button>
    </div>
  `;
  const b = document.getElementById('next');
  b.focus();
  b.onclick = advance;
}

function renderDone() {
  const depth = depthFor(state.score);
  const rows = state.log.map((e) => `
    <div class="row ${e.pts >= 60 ? 'big' : ''}">
      <span class="a">${e.answer ? esc(e.answer) : '—'}</span>
      <span class="p">${e.label} +${e.pts}</span>
    </div>`).join('');

  stage.innerHTML = `
    <p class="eyebrow">FINAL DEPTH</p>
    <p class="final">${ft(depth)}</p>
    <p class="finalsub">${esc(landmark(depth))}</p>
    <p class="finalsub2">${esc(closing(state.score))}</p>
    <div class="tape">${rows}</div>
    <div class="rowbtns">
      <button id="again">DIG AGAIN</button>
      <button class="ghost" id="share">COPY RESULT</button>
    </div>
  `;
  document.getElementById('again').onclick = begin;
  document.getElementById('share').onclick = async (ev) => {
    const marks = state.log.map((x) =>
      ({ none: '·', surface: '▁', tooclever: '▂', common: '▄', good: '▆', deep: '▇', unlisted: '█' })[x.tier]).join('');
    try {
      await navigator.clipboard.writeText(
        `STRATA — ${ft(depth)} of ${ft(BEDROCK)}\n${marks}\n${landmark(depth)}`);
      ev.target.textContent = 'COPIED';
      setTimeout(() => { ev.target.textContent = 'COPY RESULT'; }, 1500);
    } catch {
      ev.target.textContent = 'COPY BLOCKED';
    }
  };
}

/* A raw number of feet is hard to feel. Anchoring it to something real —
   "deeper than the Eiffel Tower is tall" — is what makes the score land.
   All figures are real. */
function landmark(f) {
  if (f >= 35876) return 'The floor of the world. Nothing is deeper.';
  if (f >= 29032) return 'Deeper than Everest is tall.';
  if (f >= 12766) return 'Past Mponeng — deeper than any mine ever dug.';
  if (f >= 12500) return 'You passed the Titanic on the way down.';
  if (f >= 4409)  return 'Deeper than the Grand Canyon is deep.';
  if (f >= 1450)  return 'Deeper than the Willis Tower is tall.';
  if (f >= 1083)  return 'Deeper than the Eiffel Tower is tall.';
  if (f >= 305)   return 'Deeper than the Statue of Liberty is tall.';
  if (f >= 100)   return 'Ten storeys down.';
  if (f >= 30)    return 'Down where the Clovis points are.';
  if (f >= 13)    return 'You reached the Roman road.';
  if (f >= 3)     return 'Medieval pottery. Barely started.';
  return 'You barely broke the topsoil.';
}

function closing(score) {
  const pct = score / (ROUND_LENGTH * 100);
  if (pct >= 0.9)  return 'BEDROCK. A near-perfect dig.';
  if (pct >= 0.72) return 'Through the fossil beds. Genuinely deep.';
  if (pct >= 0.5)  return 'Solid shale. You know things.';
  if (pct >= 0.3)  return 'Clay and gravel. Room to dig.';
  return 'Barely broke the topsoil.';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

render();
