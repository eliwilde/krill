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

/* The things buried down there.

   These were pixel blobs on a 10x10 grid, which at twenty screen pixels left no
   room for a silhouette — a pot, a road and a coal seam all came out as three
   coloured rectangles, so they read as icons rather than objects. They are now
   drawn as shapes on a 32x32 local grid: enough room for an actual outline, a
   lit edge and a shadowed one. Each takes the 2d context with the origin
   already translated and scaled, and draws in 0..32 space.

   Convention: light falls from the upper left (matching the lit shaft wall), so
   highlights go top/left and occlusion bottom/right. */

// small helpers so each object reads as a shape, not a list of coordinates
function poly(pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function ell(cx, cy, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
function stroke(pts, col, width, round = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  ctx.lineCap = round ? 'round' : 'butt';
  ctx.lineJoin = round ? 'round' : 'miter';
  ctx.stroke();
}

const SPRITES = {
  // a scatter of modern litter, half-turned in the soil
  coin() {
    ell(11, 20, 7, 4.5, '#8A6E1C', -0.25);            // coin, edge-on
    ell(10.4, 19, 6.6, 4.1, '#D8B43A', -0.25);
    ell(10.4, 19, 3.2, 2.0, '#F2D874', -0.25);
    poly([[20,12],[27,14],[26,19],[19,17]], '#7C4A3A'); // bottle cap, crimped
    poly([[20,12],[27,14],[26,15.5],[19.5,13.5]], '#A8664E');
    stroke([[21,24],[26,23],[28,26]], '#9AA0A6', 2.2);  // key shank
    ctx.beginPath(); ctx.arc(20.5, 24.2, 2.6, 0, 7);   // key bow
    ctx.strokeStyle = '#9AA0A6'; ctx.lineWidth = 1.8; ctx.stroke();
  },

  // a rim sherd — the curve of a vessel that is mostly gone
  pot() {
    ctx.save();
    ctx.beginPath();                                   // clip to a broken wedge
    ctx.moveTo(3, 9); ctx.lineTo(29, 7); ctx.lineTo(27, 26);
    ctx.lineTo(16, 29); ctx.lineTo(6, 22); ctx.closePath();
    ctx.clip();
    ell(16, 30, 15, 17, '#9C5138');                    // body of the vessel
    ell(16, 30, 11, 13, '#7A3F2C');                    // hollow interior
    ctx.restore();
    stroke([[3.5,9],[16,6.6],[29,7.4]], '#C4764F', 2.4); // thickened rim, lit
    stroke([[7,15],[16,13.6],[26,14.2]], '#6B3627', 1.2); // a scored band
    poly([[6,22],[16,29],[27,26]], 'rgba(0,0,0,.22)');  // broken lower edge
  },

  // clay pipe: thin stem, snapped, with the bowl still attached
  pipe() {
    stroke([[3,21],[13,19],[20,17.5]], '#E4D7BC', 2.6, false);
    stroke([[3,20.2],[13,18.2],[20,16.8]], '#F5ECD8', 1.0, false);
    poly([[20,11],[27,10],[28,18],[21,20]], '#E4D7BC'); // bowl
    poly([[20,11],[27,10],[27.4,12],[20.4,13]], '#F5ECD8');
    ell(23.6, 11.4, 3.2, 1.6, '#2E241A');              // hollow of the bowl
    poly([[12.4,19.2],[13.6,18.9],[13.2,21],[12,21.2]], '#8D8064'); // the snap
  },

  // post holes: dark stains where timber rotted in place
  post() {
    ell(9, 22, 5.5, 8, 'rgba(0,0,0,.34)');             // the stain spreads
    ell(23, 21, 5, 7.5, 'rgba(0,0,0,.34)');
    poly([[6,9],[12,8],[12.6,26],[7,27]], '#3E2C1A');  // timber ghost, packed
    poly([[6,9],[12,8],[12.2,11],[6.2,12]], '#5A4226');
    poly([[20,11],[26,10],[26.4,25],[21,26]], '#3E2C1A');
    poly([[20,11],[26,10],[26.2,13],[20.2,14]], '#5A4226');
    stroke([[8,14],[10,19],[9,24]], 'rgba(0,0,0,.4)', 1); // grain
  },

  // Roman road in section: camber, packed cobbles, kerb at each side
  road() {
    poly([[0,20],[32,20],[32,27],[0,27]], '#6E665C');  // the bedding
    ctx.save();
    ctx.beginPath();                                    // cambered surface
    ctx.moveTo(0, 19); ctx.quadraticCurveTo(16, 11, 32, 19);
    ctx.lineTo(32, 22); ctx.lineTo(0, 22); ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#9C9388'; ctx.fillRect(0, 10, 32, 13);
    for (let i = 0; i < 9; i++) {                       // set stones
      const x = i * 3.6 + 0.6;
      ctx.fillStyle = i % 2 ? '#8A8177' : '#A8A095';
      ctx.fillRect(x, 10, 3.0, 13);
    }
    ctx.restore();
    stroke([[0,19],[16,11.6],[32,19]], '#BDB5A8', 1.1); // lit crown
    poly([[0,17],[3,17],[3,24],[0,24]], '#7E7569');     // kerbstones
    poly([[29,17],[32,17],[32,24],[29,24]], '#7E7569');
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 26, 32, 2);
  },

  // a burnt horizon: a black lens with embers and cracked timber
  char() {
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.bezierCurveTo(8, 15, 22, 24, 32, 17);
    ctx.lineTo(32, 26);
    ctx.bezierCurveTo(21, 30, 9, 23, 0, 27);
    ctx.closePath();
    ctx.fillStyle = '#17120F'; ctx.fill();
    stroke([[4,19.6],[12,19],[19,22.4]], '#33291F', 1.4); // grey ash at the top
    poly([[6,22],[13,21],[13.4,23],[6.4,24]], '#241C16');  // charred timber
    poly([[18,24],[25,22.6],[25.3,24.6],[18.3,26]], '#241C16');
    ctx.fillStyle = 'rgba(190,90,30,.55)';                 // a few live embers
    ctx.fillRect(9, 22.6, 1.4, 1.4);
    ctx.fillRect(21.5, 24, 1.2, 1.2);
    ctx.fillStyle = 'rgba(230,140,50,.4)'; ctx.fillRect(15, 23, 1, 1);
  },

  // bronze: a broken blade and a ring, both gone green
  bronze() {
    poly([[4,22],[8,10],[11,9.4],[13,21],[8.6,23.4]], '#6E9C7C'); // blade
    poly([[8,10],[11,9.4],[12,16],[9.2,16.8]], '#8FBF9C');        // lit face
    stroke([[8.6,11],[10.4,20]], '#3F6A50', 0.9);                 // midrib
    poly([[4,22],[13,21],[12.4,23.6],[5,24.6]], '#3F6A50');       // broken butt
    ctx.beginPath(); ctx.arc(22, 19, 6, 0, 7);                    // ring
    ctx.strokeStyle = '#6E9C7C'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(22, 19, 6, 3.4, 5.6);
    ctx.strokeStyle = '#96C6A4'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = 'rgba(120,180,140,.3)';                       // corrosion
    ctx.fillRect(17, 22, 2, 1.6); ctx.fillRect(25, 15, 1.6, 2);
  },

  // hand axe: the teardrop biface, with flake scars
  flint() {
    poly([[16,3],[23,11],[24,21],[16,29],[8,21],[9,11]], '#6E655A');
    poly([[16,3],[23,11],[24,21],[16,29]], '#5A5148');   // shadowed half
    poly([[16,3],[9,11],[8,21],[16,29]], '#7C7266');     // lit half
    stroke([[16,4],[16,28]], '#4E463D', 0.8);            // central ridge
    stroke([[15.4,7],[11,12]], '#8E8478', 0.9);          // flake scars
    stroke([[15.6,13],[10,17]], '#8E8478', 0.9);
    stroke([[16.6,9],[21.6,13]], '#4E463D', 0.9);
    stroke([[16.6,17],[22.4,19]], '#4E463D', 0.9);
    ctx.fillStyle = 'rgba(255,240,220,.22)';             // fresh conchoidal chip
    ctx.fillRect(13.6, 24, 2.2, 2.2);
  },

  // the Clovis point still lodged in a rib
  bone() {
    stroke([[1,23],[9,19],[20,16],[31,14]], '#CFC3A6', 4.6);  // the rib
    stroke([[1,22],[9,18],[20,15],[31,13]], '#E8DDC4', 1.8);  // lit top edge
    ell(2.6, 23, 3, 2.6, '#DED2B6');                          // articular end
    poly([[17,4],[20.4,14],[18.6,22],[16.6,14]], '#7E7468');  // fluted point
    poly([[17,4],[20.4,14],[18.6,22]], '#6A6157');            // shadowed face
    stroke([[17.6,7],[18.2,19]], '#988E80', 0.8);             // the flute
    ctx.fillStyle = 'rgba(0,0,0,.4)';                         // the wound
    ctx.fillRect(16.4, 15.2, 3.4, 2.6);
  },

  // mammoth in permafrost, seen side-on
  mammoth() {
    poly([[7,11],[22,9],[26,13],[25,22],[8,23],[5,17]], '#6B4A32'); // body
    poly([[7,11],[22,9],[26,13],[24,15],[8,16]], '#7E5A3E');        // lit back
    ell(6, 15, 5, 5.5, '#6B4A32');                                  // head
    ell(5.2, 13.4, 3.6, 3.4, '#7E5A3E');                            // domed skull
    ctx.fillStyle = '#5B3A22';                                      // legs
    ctx.fillRect(10, 22, 3.4, 7); ctx.fillRect(19, 22, 3.4, 7);
    ctx.fillStyle = '#4A2C18'; ctx.fillRect(15, 22.6, 3, 6.4);
    stroke([[4,17],[2,21],[4,25]], '#6B4A32', 2.6);                 // trunk
    ctx.beginPath();                                                // tusk, curled
    ctx.moveTo(4.6, 18); ctx.quadraticCurveTo(-0.5, 22, 3, 27);
    ctx.strokeStyle = '#E8DDC4'; ctx.lineWidth = 2.2;
    ctx.lineCap = 'round'; ctx.stroke();
    for (let i = 0; i < 7; i++)                                     // shaggy coat
      stroke([[8 + i * 2.6, 22], [7.4 + i * 2.6, 26]], '#5B3A22', 1.1);
    ctx.fillStyle = 'rgba(150,210,235,.14)';                        // ice lens
    ctx.fillRect(0, 6, 32, 24);
  },

  // ammonite: a real logarithmic spiral with ribs across it
  ammonite() {
    const cx = 16, cy = 17;
    ctx.beginPath();                                    // the shell wall
    for (let i = 0; i <= 150; i++) {
      const a = i / 150 * Math.PI * 4.6;
      const r = 1.2 * Math.pow(1.19, a);
      const x = cx + Math.cos(a) * r, y = cy - Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = '#B0A078'; ctx.lineWidth = 3.4;
    ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = '#D6C79C'; ctx.lineWidth = 1.2; ctx.stroke(); // lit crest
    for (let i = 0; i < 16; i++) {                      // radial ribs
      const a = i / 16 * Math.PI * 2 + 0.4;
      const r0 = 1.2 * Math.pow(1.19, a + Math.PI * 2);
      const r1 = 1.2 * Math.pow(1.19, a + Math.PI * 4.6);
      if (r1 > 15) continue;
      stroke([[cx + Math.cos(a) * r0, cy - Math.sin(a) * r0],
              [cx + Math.cos(a) * r1, cy - Math.sin(a) * r1]], '#7E7052', 0.7);
    }
    ell(cx, cy, 1.6, 1.6, '#8A7A5C');                   // the protoconch
  },

  // coal seam: a compressed forest, with a fern still legible in it
  coal() {
    poly([[0,12],[32,10],[32,25],[0,27]], '#14100E');
    poly([[0,12],[32,10],[32,12.4],[0,14.4]], '#2E2622'); // bright cleat on top
    stroke([[0,17],[32,15.4]], 'rgba(255,255,255,.05)', 0.8);
    stroke([[0,22],[32,20.6]], 'rgba(0,0,0,.5)', 0.9);
    stroke([[6,24.6],[9,13.4]], '#33291F', 1.0);          // fern frond, pressed
    for (let i = 0; i < 7; i++) {
      const y = 23.4 - i * 1.5, s = 3.4 - i * 0.34;
      stroke([[6.4 + i * 0.42, y], [6.4 + i * 0.42 - s, y - 1.3]], '#3B3026', 0.6);
      stroke([[6.4 + i * 0.42, y], [6.4 + i * 0.42 + s, y - 1.6]], '#3B3026', 0.6);
    }
    ctx.fillStyle = 'rgba(190,200,215,.10)';              // vitreous glint
    ctx.fillRect(21, 16, 4, 1.2);
  },

  // trilobite: head shield, segmented thorax, tail
  trilobite() {
    poly([[16,4],[24,7],[25,12],[7,12],[8,7]], '#9A8A68');   // cephalon
    ell(16, 9.6, 2.6, 3.0, '#B4A480');                       // glabella
    ell(11.4, 8.6, 1.2, 1.4, '#43391F');                     // eyes
    ell(20.6, 8.6, 1.2, 1.4, '#43391F');
    for (let i = 0; i < 7; i++) {                            // thoracic segments
      const y = 13 + i * 2.1, wdt = 8.6 - i * 0.5;
      poly([[16 - wdt, y], [16 + wdt, y], [16 + wdt - 1, y + 1.7],
            [16 - wdt + 1, y + 1.7]], i % 2 ? '#8A7A5C' : '#948464');
      poly([[16 - wdt, y], [16 + wdt, y], [16 + wdt, y + 0.6],
            [16 - wdt, y + 0.6]], '#AD9D78');
    }
    poly([[11,28],[21,28],[19,31.4],[13,31.4]], '#7E7052');  // pygidium
    stroke([[16,12.6],[16,30]], '#6A5C44', 0.8);             // axial lobe
    stroke([[12.4,12.6],[13.6,29]], '#6A5C44', 0.6);
    stroke([[19.6,12.6],[18.4,29]], '#6A5C44', 0.6);
  },

  // a diamond still in the kimberlite that carried it up
  diamond() {
    poly([[2,10],[13,6],[26,11],[29,23],[16,29],[4,24]], '#2A2622'); // host rock
    poly([[2,10],[13,6],[26,11],[24,14],[5,15]], '#3B352E');
    ctx.fillStyle = 'rgba(120,150,120,.18)';                 // olivine flecks
    ctx.fillRect(6, 18, 2, 1.6); ctx.fillRect(22, 19, 1.8, 1.6);
    poly([[16,10],[22,15],[16,24],[10,15]], '#8FD0E0');      // the octahedron
    poly([[16,10],[22,15],[16,24]], '#6FB0C8');              // right face, shaded
    poly([[16,10],[10,15],[16,24]], '#BFE8F0');              // left face, lit
    stroke([[10,15],[22,15]], '#DFF4FA', 0.7);               // girdle
    ctx.fillStyle = 'rgba(255,255,255,.85)';                 // specular
    ctx.fillRect(13.4, 13.4, 1.6, 1.6);
  },

  // the Titanic's bow, buried to the anchors in silt
  wreck() {
    ctx.beginPath();                                          // hull, listing
    ctx.moveTo(1, 16); ctx.lineTo(23, 12);
    ctx.quadraticCurveTo(30, 12.4, 29, 18);
    ctx.lineTo(26, 25); ctx.lineTo(4, 25); ctx.closePath();
    ctx.fillStyle = '#463C33'; ctx.fill();
    poly([[1,16],[23,12],[23.4,14],[1.4,18]], '#5E5248');     // sheer strake, lit
    stroke([[3,20.4],[26,17.2]], '#332C25', 1.0);             // plating seam
    for (let i = 0; i < 8; i++) {                             // portholes
      ctx.fillStyle = '#17120F';
      ctx.fillRect(4 + i * 2.7, 19.6 - i * 0.38, 1.3, 1.3);
    }
    stroke([[9,12.6],[9,5]], '#5E5248', 1.6);                 // foremast
    stroke([[6,6.6],[12,5.6]], '#5E5248', 1.0);               // crow's nest yard
    ell(24.6, 16.4, 2.2, 1.8, '#2B241E');                     // hawse / anchor
    ctx.fillStyle = 'rgba(90,120,130,.22)';                   // rusticle drips
    ctx.fillRect(7, 21, 1, 4); ctx.fillRect(14, 20.4, 1, 5);
    ctx.fillRect(20, 19.6, 1, 4.6);
    ell(15, 26, 15, 3.4, '#1B2027');                          // silt it sits in
  },

  // Mponeng: a headframe over the shaft, cage on the rope
  mine() {
    poly([[11,2],[21,2],[24,26],[8,26]], 'rgba(0,0,0,.18)');
    stroke([[12,3],[9,26]], '#8C8378', 1.8);                  // headframe legs
    stroke([[20,3],[23,26]], '#8C8378', 1.8);
    stroke([[11.4,3],[20.6,3]], '#A09689', 2.0);              // sheave deck
    ctx.beginPath(); ctx.arc(16, 4.6, 2.6, 0, 7);             // sheave wheel
    ctx.strokeStyle = '#B4AA9C'; ctx.lineWidth = 1.4; ctx.stroke();
    stroke([[10.6,8],[21.4,8]], '#6E655A', 1.2);              // bracing
    stroke([[10.8,14],[21.2,14]], '#6E655A', 1.2);
    stroke([[11.4,3],[21,14]], '#6E655A', 0.9);
    stroke([[20.6,3],[11,14]], '#6E655A', 0.9);
    stroke([[16,7],[16,20]], '#9C9388', 0.9);                 // hoist rope
    poly([[13,20],[19,20],[19,25],[13,25]], '#4E463D');       // the cage
    poly([[13,20],[19,20],[19,21],[13,21]], '#6E655A');
    ctx.fillStyle = 'rgba(255,220,150,.5)';                   // a lamp in it
    ctx.fillRect(15.2, 22, 1.6, 1.6);
    ctx.fillStyle = '#17120F'; ctx.fillRect(12, 26, 8, 6);    // the collar
  },

  // Challenger Deep: the trench floor, and one thing alive on it
  trench() {
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.bezierCurveTo(7, 26, 12, 27, 16, 27);
    ctx.bezierCurveTo(20, 27, 25, 26, 32, 18);
    ctx.lineTo(32, 32); ctx.lineTo(0, 32); ctx.closePath();
    ctx.fillStyle = '#060C14'; ctx.fill();
    stroke([[0,18],[8,25.4],[16,27]], '#16202C', 1.2);        // lit trench wall
    stroke([[16,27],[24,25.4],[32,18]], '#101822', 1.2);
    ctx.fillStyle = 'rgba(120,160,190,.10)';                  // sediment haze
    ctx.fillRect(0, 26, 32, 3);
    ell(20, 25.4, 3, 1.5, '#7E93A6');                         // amphipod, pale
    stroke([[17.4,25],[14.6,23.6]], '#7E93A6', 0.7);          // antennae
    stroke([[17.4,25.6],[14.8,26.4]], '#7E93A6', 0.7);
    for (let i = 0; i < 4; i++)                               // legs
      stroke([[19 + i * 1.1, 26.2], [18.6 + i * 1.1, 27.6]], '#63768A', 0.5);
    ctx.fillStyle = 'rgba(150,220,255,.5)'; ctx.fillRect(7, 21, 1, 1); // marine snow
    ctx.fillStyle = 'rgba(150,220,255,.3)'; ctx.fillRect(26, 23, 1, 1);
  },

  // the surface: turf in section, with roots going down
  grass() {
    poly([[0,18],[32,17],[32,32],[0,32]], '#4A3524');         // soil below
    poly([[0,18],[32,17],[32,21],[0,22]], '#5C4229');
    for (let i = 0; i < 16; i++) {                            // blades
      const x = i * 2.1 + 0.6, hgt = 5 + rnd(i, 3) * 7;
      stroke([[x, 19], [x + (rnd(i, 7) - 0.5) * 4, 19 - hgt]],
             i % 3 ? '#4E6B32' : '#638240', 1.3);
    }
    stroke([[0,18.6],[32,17.6]], '#6E8B52', 1.4);             // the turf line
    for (let i = 0; i < 5; i++) {                             // roots
      const x = 3 + i * 6.4;
      stroke([[x, 20], [x + 1.4, 25], [x - 1, 30]], '#3E2C1A', 0.9);
      stroke([[x + 1.2, 24], [x + 4, 27]], '#3E2C1A', 0.6);
    }
  },
};

/* Draw one find, embedded in the ground rather than sitting on it. The soil
   gets a dug pocket behind the object and a lip of disturbed earth in front, so
   it reads as something uncovered — which is the whole point of the descent. */
function drawSprite(name, x, y, size = 30, seed = 0) {
  const fn = SPRITES[name];
  if (!fn) return;
  const k = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);

  // the pocket of disturbed earth the object sits in
  ctx.beginPath();
  ctx.ellipse(16, 18, 19, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.30)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(15, 16.5, 17, 14, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,220,170,.05)';
  ctx.fill();

  // a slight per-object tilt: nothing stays level for three thousand years
  ctx.translate(16, 16);
  ctx.rotate((rnd(seed, 11) - 0.5) * 0.30);
  ctx.translate(-16, -16);

  ctx.save();
  fn();
  ctx.restore();

  // grit lying over the find, so it is partly still buried
  for (let i = 0; i < 9; i++) {
    const gx = rnd(seed, i + 40) * 30;
    const gy = 16 + rnd(seed, i + 60) * 15;
    ctx.fillStyle = rnd(seed, i + 80) > 0.5 ? 'rgba(0,0,0,.34)'
                                            : 'rgba(58,42,28,.5)';
    ctx.fillRect(gx, gy, 1.4 + rnd(seed, i + 20) * 2.6, 1.4);
  }
  ctx.restore();
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

    // The find sits just outside the shaft wall, in the ground. Headline
    // depths get a larger object — they are the ones worth stopping at.
    if (s.icon) {
      const size = major ? 42 : 32;
      const ix = side ? shaftX - size - 10 : shaftX + shaftW + 10;
      drawSprite(s.icon, ix, y - size / 2, size, s.ft);
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
