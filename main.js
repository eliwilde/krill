import { buildRound, scoreAnswer, STRATA, CONFIG } from './game.js';

const { SECONDS, M_PER_POINT, ROUND_LENGTH, BEDROCK } = CONFIG;

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

/** Metres-per-pixel: the whole 7000m dig spans about 9 screens. */
const MPP = 1.9;

function bandColour(m) {
  if (m < 300)  return '#6B4423';
  if (m < 900)  return '#613D1F';
  if (m < 1700) return '#7A4A28';
  if (m < 2600) return '#5C3A20';
  if (m < 3400) return '#4A2F1B';
  if (m < 4200) return '#3E2A18';
  if (m < 5200) return '#332316';
  if (m < 6200) return '#2A1D13';
  return '#1A1410';
}

function drawWorld() {
  const w = innerWidth, h = innerHeight;
  const sx = shake ? (rnd(t, 1) - 0.5) * shake : 0;
  const sy = shake ? (rnd(t, 2) - 0.5) * shake : 0;
  ctx.save();
  ctx.translate(sx, sy);

  // --- sky above ground, soil below -------------------------------------
  const groundPx = (0 - camY) / MPP;   // y-pixel of the surface line

  if (groundPx > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(groundPx, 1));
    g.addColorStop(0, '#F3E3BC');
    g.addColorStop(1, '#D9B67E');
    ctx.fillStyle = g;
    ctx.fillRect(-4, -4, w + 8, groundPx + 4);

    // sun
    ctx.fillStyle = '#F0B44C';
    const sunY = groundPx - 120;
    ctx.fillRect(w - 130, sunY, 46, 46);

    // a low ridge line so the horizon isn't a bare edge
    ctx.fillStyle = '#C9A06A';
    for (let i = 0; i < w + 40; i += 40) {
      const hh = 14 + rnd(i, 7) * 22;
      ctx.fillRect(i - 20, groundPx - hh, 40, hh);
    }
  }

  // --- soil bands --------------------------------------------------------
  const startBand = Math.floor(camY / 100) * 100;
  for (let m = startBand; m < camY + h * MPP + 200; m += 100) {
    if (m < 0) continue;
    const y = (m - camY) / MPP;
    ctx.fillStyle = bandColour(m);
    ctx.fillRect(-4, y, w + 8, 100 / MPP + 1.5);

    // speckle texture — grit, pebbles, fossils deeper down
    for (let i = 0; i < 16; i++) {
      const px = rnd(m, i) * w;
      const py = y + rnd(m, i + 50) * (100 / MPP);
      const sz = 1 + Math.floor(rnd(m, i + 90) * 3);
      ctx.fillStyle = rnd(m, i + 30) > 0.72 ? 'rgba(255,220,160,.13)' : 'rgba(0,0,0,.22)';
      ctx.fillRect(px, py, sz, sz);
    }
  }

  // --- the shaft ---------------------------------------------------------
  const shaftW = Math.min(148, w * 0.34);
  const shaftX = w / 2 - shaftW / 2;
  const topPx = Math.max((0 - camY) / MPP, -10);
  const digPx = (diggerY - camY) / MPP;

  ctx.fillStyle = '#120D09';
  ctx.fillRect(shaftX, topPx, shaftW, Math.max(digPx - topPx, 0));
  // shaft walls
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.fillRect(shaftX - 3, topPx, 3, Math.max(digPx - topPx, 0));
  ctx.fillRect(shaftX + shaftW, topPx, 3, Math.max(digPx - topPx, 0));

  // rope
  ctx.fillStyle = '#8A6B3F';
  ctx.fillRect(w / 2 - 1, topPx, 2, Math.max(digPx - topPx, 0));

  // --- strata labels -----------------------------------------------------
  ctx.font = '10px "DM Mono", monospace';
  for (const s of STRATA) {
    const y = (s.m - camY) / MPP;
    if (y < -30 || y > h + 30) continue;
    const major = s.text === s.text.toUpperCase();
    ctx.fillStyle = major ? 'rgba(240,180,76,.75)' : 'rgba(200,170,120,.34)';
    const side = (s.m / 400) % 2 < 1;
    const tx = side ? 16 : w - 16;
    ctx.textAlign = side ? 'left' : 'right';
    ctx.fillText(s.text, tx, y);
    // tick
    ctx.fillRect(side ? 16 : w - 46, y + 5, 30, 1);
  }
  ctx.textAlign = 'left';

  // --- the digger --------------------------------------------------------
  if (digPx > -40 && digPx < h + 40) {
    const bob = calm ? 0 : Math.sin(t * 0.06) * 2;
    const dx = w / 2;
    const dy = digPx + bob;

    // cage
    ctx.fillStyle = '#F0B44C';
    ctx.fillRect(dx - 13, dy - 12, 26, 3);
    ctx.fillRect(dx - 13, dy - 12, 3, 24);
    ctx.fillRect(dx + 10, dy - 12, 3, 24);
    ctx.fillRect(dx - 13, dy + 9, 26, 3);
    // occupant
    ctx.fillStyle = '#E2663B';
    ctx.fillRect(dx - 5, dy - 6, 10, 10);
    ctx.fillStyle = '#F2E8D5';
    ctx.fillRect(dx - 3, dy - 4, 3, 3);
    // lamp glow
    const glow = ctx.createRadialGradient(dx, dy, 2, dx, dy, 90);
    glow.addColorStop(0, 'rgba(240,180,76,.30)');
    glow.addColorStop(1, 'rgba(240,180,76,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(dx - 90, dy - 90, 180, 180);
  }

  // --- dust motes drifting up -------------------------------------------
  if (!calm) {
    for (let i = 0; i < 26; i++) {
      const seed = i * 13.37;
      const dxp = rnd(seed, 1) * w;
      const span = h + 120;
      const dyp = ((rnd(seed, 2) * span) - (t * (0.25 + rnd(seed, 3) * 0.5)) % span + span) % span;
      ctx.fillStyle = `rgba(240,200,140,${0.05 + rnd(seed, 4) * 0.13})`;
      ctx.fillRect(dxp, dyp, 2, 2);
    }
  }

  // vignette keeps the centre readable
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.92);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.66)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function loop() {
  t++;
  camY += (targetY - camY) * 0.075;
  diggerY += (targetDig - diggerY) * 0.075;
  if (shake > 0) shake *= 0.86;
  if (shake < 0.15) shake = 0;

  // live depth readout tracks the animation, so the number climbs with the fall
  elDepth.textContent = `${Math.round(diggerY).toLocaleString()}m`;
  elStrat.textContent = currentStratum(diggerY);

  drawWorld();
  requestAnimationFrame(loop);
}

function currentStratum(m) {
  let cur = STRATA[0];
  for (const s of STRATA) if (m >= s.m) cur = s;
  return cur.text.toUpperCase().slice(0, 34);
}

function diveTo(metres) {
  targetDig = metres;
  // Keep the digger around 45% down the viewport. The clamp stops the camera
  // rising so far at 0m that the sky fills the screen and clips the sun.
  targetY = Math.max(metres - (innerHeight * MPP) * 0.45, -innerHeight * MPP * 0.38);
  shake = calm ? 0 : 7;
}

size();
diveTo(0);
camY = targetY; diggerY = 0;
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
  diveTo(score * M_PER_POINT);
  setState({
    screen: 'verdict',
    score,
    log: [...state.log, { q: prompt.q, answer: String(raw).trim(), ...res }],
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
      The rarer the answer, the deeper you dig.
      <b>The clever one you're proud of? Everyone thought of that too.</b>
    </p>
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
    <p class="gain">+${last.pts} PTS · DIG ${last.pts * M_PER_POINT}m</p>
    <p class="note">${last.note}</p>
    <div class="rowbtns" style="margin-top:28px">
      <button id="next">${isEnd ? 'SEE THE DIG ▼' : 'KEEP DIGGING ▼'}</button>
    </div>
  `;
  const b = document.getElementById('next');
  b.focus();
  b.onclick = advance;
}

function renderDone() {
  const depth = state.score * M_PER_POINT;
  const rows = state.log.map((e) => `
    <div class="row ${e.pts >= 60 ? 'big' : ''}">
      <span class="a">${e.answer ? esc(e.answer) : '—'}</span>
      <span class="p">${e.label} +${e.pts}</span>
    </div>`).join('');

  stage.innerHTML = `
    <p class="eyebrow">FINAL DEPTH</p>
    <p class="final">${depth.toLocaleString()}m</p>
    <p class="finalsub">${esc(closing(state.score))}</p>
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
      await navigator.clipboard.writeText(`STRATA — ${depth.toLocaleString()}m of ${BEDROCK.toLocaleString()}m\n${marks}`);
      ev.target.textContent = 'COPIED';
      setTimeout(() => { ev.target.textContent = 'COPY RESULT'; }, 1500);
    } catch {
      ev.target.textContent = 'COPY BLOCKED';
    }
  };
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
