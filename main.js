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

  // A rim sherd — a fragment, not a pot. Symmetry made it read as an intact
  // urn, so the outline is deliberately lopsided and broken on three sides.
  pot() {
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(4.5, 12);                              // left break, jagged
      ctx.lineTo(9, 9.6);
      ctx.quadraticCurveTo(17, 7.2, 26.5, 11);          // the rim, curving away
      ctx.lineTo(24, 18.5);
      ctx.lineTo(25.5, 21);                             // stepped break
      ctx.lineTo(20, 24.5);
      ctx.lineTo(16.5, 22.5);
      ctx.lineTo(10, 23);                               // ragged lower edge
      ctx.lineTo(7.5, 18);
      ctx.closePath();
    };
    body();
    ctx.fillStyle = '#9C5138'; ctx.fill();

    ctx.save(); body(); ctx.clip();
    ctx.beginPath();                                    // interior seen past rim
    ctx.moveTo(6, 13.5);
    ctx.quadraticCurveTo(17, 10.4, 26, 13.8);
    ctx.lineTo(28, 2); ctx.lineTo(4, 2); ctx.closePath();
    ctx.fillStyle = '#6E3626'; ctx.fill();
    stroke([[5,17.5],[17,20.4],[27,17.6]], '#89452F', 1.1);   // scored bands
    stroke([[5,19.8],[17,22.7],[27,19.9]], '#B0603F', 0.7);
    ctx.fillStyle = 'rgba(255,225,190,.10)';            // worn patch
    ctx.fillRect(11, 14.5, 7, 3);
    ctx.restore();

    stroke([[9,9.6],[17,7.4],[26.5,11]], '#C4764F', 1.9);     // thickened rim
    // pale fresh-broken edges: the giveaway that this is a fragment
    stroke([[4.5,12],[7.5,18],[10,23]], '#C99070', 0.8);
    stroke([[24,18.5],[25.5,21],[20,24.5]], '#C99070', 0.8);
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
    ctx.moveTo(0, 18.4); ctx.quadraticCurveTo(16, 15, 32, 18.4);
    ctx.lineTo(32, 22); ctx.lineTo(0, 22); ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#9C9388'; ctx.fillRect(0, 13, 32, 10);
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
    // frozen in, not behind glass: a soft lens of ice over the body only
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(16, 18, 15, 13, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(150,210,235,.13)';
    ctx.fillRect(0, 0, 32, 32);
    stroke([[3,9],[12,13],[9,20]], 'rgba(200,235,250,.16)', 1.2);   // frost veins
    stroke([[24,8],[21,15],[27,21]], 'rgba(200,235,250,.12)', 1.0);
    ctx.restore();
  },

  // ammonite: a real logarithmic spiral with ribs across it
  ammonite() {
    const cx = 16, cy = 17, TURNS = Math.PI * 5.0, G = 1.175;
    const at = a => 1.05 * Math.pow(G, a);
    // A whorl has to thicken as it coils; a constant-width stroke reads as a
    // flat spring. Fill the band between the outer spiral and the one a full
    // turn inside it, which is exactly how the shell is built.
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {                    // outer edge, outward
      const a = i / 200 * TURNS, r = at(a);
      const x = cx + Math.cos(a) * r, y = cy - Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    for (let i = 200; i >= 0; i--) {                    // inner edge, back in
      const a = i / 200 * TURNS;
      const r = Math.max(at(a - Math.PI * 2), 0.5);
      ctx.lineTo(cx + Math.cos(a) * r, cy - Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#B0A078'; ctx.fill();
    ctx.strokeStyle = '#6A5C44'; ctx.lineWidth = 0.6; ctx.stroke(); // suture

    ctx.save(); ctx.clip();                             // ribs, inside the shell
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TURNS;
      const r0 = at(a - Math.PI * 2), r1 = at(a);
      stroke([[cx + Math.cos(a) * r0, cy - Math.sin(a) * r0],
              [cx + Math.cos(a) * r1, cy - Math.sin(a) * r1]], '#8F7F5E', 0.8);
    }
    // light from upper left, falling across the coil
    ctx.fillStyle = 'rgba(240,228,196,.22)';
    ctx.beginPath(); ctx.arc(cx - 3, cy - 4, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.20)';
    ctx.beginPath(); ctx.arc(cx + 7, cy + 8, 11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ell(cx, cy, 1.3, 1.3, '#7E7052');                   // the protoconch
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
    // Thorax as one tapering body with segment grooves cut across it — drawn
    // as separate bars it read as a ladder rather than an animal.
    ctx.beginPath();
    ctx.moveTo(8.4, 12.4);
    ctx.quadraticCurveTo(7.4, 21, 11.6, 27.4);               // left flank
    ctx.lineTo(20.4, 27.4);
    ctx.quadraticCurveTo(24.6, 21, 23.6, 12.4);              // right flank
    ctx.closePath();
    ctx.fillStyle = '#8A7A5C'; ctx.fill();
    ctx.save(); ctx.clip();
    poly([[13,10],[19,10],[19,28],[13,28]], '#A2926E');      // raised axial lobe
    for (let i = 0; i < 8; i++) {                            // segment grooves
      const y = 13.4 + i * 1.8;
      stroke([[6, y], [26, y]], 'rgba(60,50,32,.55)', 0.7);
      stroke([[6, y + 0.7], [26, y + 0.7]], 'rgba(220,205,170,.22)', 0.5);
    }
    ctx.restore();
    poly([[11.6,27.4],[20.4,27.4],[18.4,31.2],[13.6,31.2]], '#7E7052'); // pygidium
    stroke([[13.2,12.6],[14.2,27]], '#6A5C44', 0.7);         // axial furrows
    stroke([[18.8,12.6],[17.8,27]], '#6A5C44', 0.7);
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

  // Terracotta warrior: a rank of them, the front one whole and the rest
  // receding. The army only reads as an army in plural, so it is drawn plural.
  warrior() {
    const man = (x, s, body, lit) => {                          // s: scale 0..1
      const top = 20 - 15 * s;
      poly([[x - 3.2 * s, 30], [x - 3.6 * s, top + 5 * s],      // torso, flaring
            [x + 3.6 * s, top + 5 * s], [x + 3.2 * s, 30]], body);
      poly([[x - 3.6 * s, top + 5 * s], [x + 3.6 * s, top + 5 * s],
            [x + 3 * s, top + 8 * s], [x - 3 * s, top + 8 * s]], lit); // shoulders
      ell(x, top + 2.4 * s, 2.3 * s, 2.8 * s, body);            // head
      ell(x - 0.6 * s, top + 1.8 * s, 1.5 * s, 1.9 * s, lit);
      poly([[x - 2.4 * s, top], [x + 2.4 * s, top],             // topknot/cap
            [x + 1.6 * s, top - 2 * s], [x - 1.6 * s, top - 2 * s]], body);
    };
    man(25, 0.62, '#6B4632', '#82583F');                        // back rank, dim
    man(19.5, 0.78, '#7A5139', '#946347');
    man(11, 1.0, '#8C5D42', '#AC7452');                         // front, lit
    stroke([[11, 22], [11, 29]], '#6B4632', 0.8);               // armour seam
    stroke([[8.4, 21], [13.6, 21]], '#6B4632', 0.7);
    ctx.fillStyle = 'rgba(0,0,0,.30)';                          // ground shadow
    ctx.fillRect(0, 30, 32, 2);
  },

  // Göbekli Tepe: the T-pillars, carved and then deliberately backfilled
  pillar() {
    // The crossbar has to overhang hard — a narrow head just reads as a column.
    const tee = (x, y, s, face, side) => {
      poly([[x - 7 * s, y], [x + 7 * s, y],                     // the T head, broad
            [x + 7 * s, y + 3.4 * s], [x - 7 * s, y + 3.4 * s]], face);
      poly([[x + 7 * s, y], [x + 7 * s, y + 3.4 * s],
            [x + 5.4 * s, y + 4 * s], [x + 5.4 * s, y + 0.6 * s]], side);
      poly([[x - 2.4 * s, y + 3.4 * s], [x + 2.4 * s, y + 3.4 * s],  // the shaft
            [x + 2.2 * s, 30], [x - 2.2 * s, 30]], face);
      poly([[x + 2.4 * s, y + 3.4 * s], [x + 2.2 * s, 30],
            [x + 3.2 * s, 29.4], [x + 3.4 * s, y + 4 * s]], side);
    };
    tee(24, 13, 0.60, '#8E8272', '#6B6154');                    // rear pillar
    tee(10, 7, 0.92, '#A89A86', '#7D7263');                     // near pillar
    stroke([[8.6, 14], [8.6, 21]], '#7D7263', 0.8);             // carved relief
    stroke([[8.6, 21], [11, 23]], '#7D7263', 0.8);              // an arm, bent
    ell(11.2, 17, 1.4, 1.0, '#7D7263');                         // a beast, worn
    ctx.fillStyle = 'rgba(92,70,44,.55)';                       // the backfill
    ctx.fillRect(0, 26, 32, 6);
    stroke([[0, 26], [32, 25.4]], 'rgba(120,94,62,.6)', 1.2);
  },

  // a bunker: concrete, a blast door, a stair going down into it
  bunker() {
    poly([[3, 12], [29, 11], [29, 30], [3, 30]], '#5E5B54');    // the box
    poly([[3, 12], [29, 11], [29, 14], [3, 15]], '#767268');    // lit top edge
    poly([[24, 12], [29, 11], [29, 30], [24, 30]], '#4A4841');  // shadowed side
    poly([[9, 17], [19, 16.4], [19, 30], [9, 30]], '#2A2823');  // doorway, dark
    poly([[9, 17], [19, 16.4], [19, 18], [9, 18.6]], '#3C3A34');
    stroke([[14, 18], [14, 29]], '#4A4841', 0.8);               // door seam
    ell(16.8, 23.5, 1, 1, '#B79A5E');                           // handle
    for (let i = 0; i < 4; i++)                                 // stair treads
      ctx.fillStyle = 'rgba(0,0,0,.30)',
      ctx.fillRect(9, 22 + i * 2, 10, 1);
    ctx.fillStyle = 'rgba(255,240,200,.07)';                    // grazing light
    ctx.fillRect(3, 12, 2, 18);
  },

  // a taproot, still going down after two hundred feet, still finding water
  root() {
    stroke([[16, 0], [15, 7], [17, 14], [15.5, 22], [16.5, 32]], '#5A4128', 3.2);
    stroke([[15.6, 0], [14.6, 7], [16.6, 14], [15.1, 22]], '#74542F', 1.3); // lit side
    stroke([[16, 6], [11, 9], [7, 8]], '#5A4128', 1.5);         // laterals
    stroke([[16.4, 13], [21, 16], [25, 15]], '#5A4128', 1.4);
    stroke([[15.6, 20], [11, 24], [8, 23.4]], '#5A4128', 1.2);
    stroke([[16.6, 27], [20, 30], [24, 29.6]], '#5A4128', 1.0);
    stroke([[7, 8], [4, 6.6]], '#6B4E2C', 0.7);                 // fine hairs
    stroke([[25, 15], [28, 13.6]], '#6B4E2C', 0.7);
    stroke([[8, 23.4], [5, 22.4]], '#6B4E2C', 0.6);
    ctx.fillStyle = 'rgba(110,150,170,.20)';                    // the water it found
    ctx.fillRect(0, 28, 32, 4);
    ell(6, 29.6, 2.2, 0.9, 'rgba(150,200,220,.28)');
  },

  // Derinkuyu in section: rooms stacked down, a ventilation shaft through them
  city() {
    poly([[0, 4], [32, 3], [32, 32], [0, 32]], '#6B5335');      // the cut rock
    ctx.fillStyle = 'rgba(0,0,0,.45)';                          // chambers
    const room = (x, y, rw, rh) => {
      ctx.fillStyle = '#231B12'; ctx.fillRect(x, y, rw, rh);
      ctx.fillStyle = 'rgba(255,214,140,.10)'; ctx.fillRect(x, y, rw, 1);
      ctx.fillStyle = 'rgba(240,180,76,.55)';                   // a lamp burning
      ctx.fillRect(x + 1.4, y + rh - 2.4, 1.2, 1.2);
    };
    // Irregular on purpose: even spacing made this read as shelving. Real
    // Derinkuyu is rooms hacked out wherever the tuff allowed.
    room(2.5, 6.5, 8, 4);    room(18, 8, 11, 5.5);
    room(4, 13.5, 6.5, 6.5); room(21, 16.5, 8, 4);
    room(2, 23, 9.5, 4.5);   room(18.5, 22.5, 7, 6.5);
    ctx.fillStyle = '#1A140D';                                  // ventilation shaft
    ctx.fillRect(13, 3, 5, 29);
    ctx.fillStyle = 'rgba(255,214,140,.10)'; ctx.fillRect(13, 3, 1.4, 29);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(16.6, 3, 1.4, 29);
    for (const y of [11, 20.5])                                 // connecting stairs
      stroke([[10.5, y], [13, y + 2.2]], '#3E3222', 1.3),
      stroke([[18, y + 1], [16.4, y + 3]], '#3E3222', 1.3);
    // the round stone door — the thing Derinkuyu is actually known for
    ell(11.5, 18.5, 2.6, 2.6, '#8A6F46');
    ell(10.8, 17.8, 1.7, 1.7, '#A6884F');
    ell(11.5, 18.5, 0.8, 0.8, '#2A2016');
  },

  // Naica: selenite blades, far bigger than the people who found them
  crystal() {
    const blade = (pts, face, lit) => { poly(pts, face); poly(lit[0], lit[1]); };
    blade([[2, 30], [9, 4], [13, 5], [9, 30]], '#CFE0DA',       // tallest blade
          [[[9, 4], [13, 5], [11.5, 30], [9, 30]], '#9FBDB4']);
    blade([[12, 31], [21, 9], [25, 11], [19, 31]], '#E2EFEA',
          [[[21, 9], [25, 11], [22, 31], [19, 31]], '#B2CCC3']);
    blade([[21, 31], [28, 16], [31, 18], [27, 31]], '#BFD4CC',
          [[[28, 16], [31, 18], [29, 31], [27, 31]], '#93B2A8']);
    stroke([[9, 6], [9, 29]], 'rgba(255,255,255,.45)', 0.7);    // specular edges
    stroke([[21, 11], [20, 30]], 'rgba(255,255,255,.55)', 0.8);
    ctx.fillStyle = 'rgba(255,255,255,.18)';                    // glare
    ctx.fillRect(10, 8, 2, 9);
  },

  // the deepest animal alive: blind, wingless, and about a millimetre long
  springtail() {
    ell(15, 19, 7.5, 4.2, '#C9C2B0', -0.18);                    // body, segmented
    ell(13.5, 17.6, 6.2, 3.0, '#E4DDC9', -0.18);                // lit back
    ell(22.6, 20.6, 3.0, 2.4, '#B5AD9A');                       // head
    stroke([[24.6, 19.4], [29, 16.6]], '#B5AD9A', 0.8);         // antennae
    stroke([[24.6, 21.2], [29, 20.2]], '#B5AD9A', 0.8);
    for (let i = 0; i < 3; i++) {                               // legs
      stroke([[16 + i * 3.4, 22], [15 + i * 3.4, 26.4]], '#A79F8C', 0.8);
      stroke([[15 + i * 3.4, 26.4], [13.4 + i * 3.4, 27.2]], '#A79F8C', 0.6);
    }
    stroke([[8.5, 21], [4, 25], [6.5, 26.6]], '#B5AD9A', 1.0);  // the furca
    for (let i = 1; i < 4; i++)                                 // segment lines
      stroke([[11 + i * 3, 15.6], [10.4 + i * 3, 22.4]], 'rgba(150,140,120,.45)', 0.5);
  },

  // two billion year old water: a seam of it, sealed in the rock
  water() {
    poly([[0, 0], [32, 0], [32, 13], [0, 15]], '#2A2620');      // rock above
    poly([[0, 22], [32, 20], [32, 32], [0, 32]], '#241F1A');    // rock below
    ctx.fillStyle = '#2E4A52';                                  // the seam
    ctx.beginPath();
    ctx.moveTo(0, 15); ctx.lineTo(32, 13); ctx.lineTo(32, 20); ctx.lineTo(0, 22);
    ctx.closePath(); ctx.fill();
    stroke([[0, 15], [32, 13]], 'rgba(150,200,215,.35)', 1.0);  // meniscus, lit
    stroke([[0, 22], [32, 20]], 'rgba(0,0,0,.4)', 1.0);
    ell(9, 17.6, 3.6, 1.4, 'rgba(170,215,230,.22)');            // sheen
    ell(23, 16.4, 2.4, 1.0, 'rgba(170,215,230,.16)');
    ctx.fillStyle = 'rgba(190,225,235,.5)';                     // dissolved gas
    ctx.fillRect(13, 18, 1.2, 1.2);
    ctx.fillRect(27, 17, 1, 1);
    ctx.fillRect(5, 19, 1, 1);
  },

  // bacteria living on uranium decay: rods in a fracture, faintly lit
  microbe() {
    poly([[0, 0], [32, 0], [32, 11], [0, 14]], '#2B2722');      // fracture walls
    poly([[0, 21], [32, 18], [32, 32], [0, 32]], '#231F1B');
    ctx.fillStyle = '#12100E';                                  // the void between
    ctx.beginPath();
    ctx.moveTo(0, 14); ctx.lineTo(32, 11); ctx.lineTo(32, 18); ctx.lineTo(0, 21);
    ctx.closePath(); ctx.fill();
    const rod = (x, y, rot) => {                                // one bacterium
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ell(0, 0, 3.0, 1.15, '#8FCBA8');
      ell(-0.7, -0.35, 2.0, 0.6, '#C6ECD6');
      ctx.restore();
    };
    rod(8, 16.6, 0.22); rod(17, 15.2, -0.32); rod(25, 14.6, 0.14); rod(13, 18.4, -0.1);
    ctx.fillStyle = 'rgba(143,203,168,.13)';                    // their faint glow
    ctx.fillRect(0, 12, 32, 9);
    ctx.fillStyle = '#7FE04A';                                  // uranium speck
    ctx.fillRect(21, 19.6, 1.4, 1.4);
    ctx.fillStyle = 'rgba(127,224,74,.30)';
    ctx.fillRect(19.6, 18.2, 4.2, 4.2);
  },

  // Kola: plankton fossils, four miles down, in rock that should not hold them
  plankton() {
    poly([[0, 0], [32, 0], [32, 32], [0, 32]], '#241C24');      // metamorphic rock
    stroke([[0, 8], [32, 5]], 'rgba(120,100,120,.30)', 1.0);    // foliation, folded
    stroke([[0, 17], [32, 13]], 'rgba(120,100,120,.24)', 1.0);
    stroke([[0, 26], [32, 23]], 'rgba(120,100,120,.20)', 1.0);
    // the shells themselves: coccoliths and a diatom, chalk-white in the dark
    const disc = (x, y, r) => {
      ell(x, y, r, r * 0.82, '#EFE9DC');
      ell(x, y, r * 0.52, r * 0.42, '#C3BBA9');
      for (let i = 0; i < 8; i++) {                             // radial plates
        const a = (i / 8) * Math.PI * 2;
        stroke([[x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.45],
                [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82]], '#B5AC98', 0.5);
      }
    };
    disc(10, 11, 4.4);
    disc(23, 21, 3.4);
    ell(22, 9, 3.6, 2.0, '#E4DCCB', 0.5);                       // a diatom, oblong
    stroke([[19.2, 7.6], [24.8, 10.4]], '#B5AC98', 0.5);
    ell(9, 24, 2.2, 1.4, '#D8D0BF', -0.3);
    ctx.fillStyle = 'rgba(239,233,220,.5)';                     // fragments
    ctx.fillRect(16, 27, 1.4, 1.4);
    ctx.fillRect(5, 17, 1.2, 1.2);
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

  // The pocket of disturbed earth the object sits in. A flat ellipse stamped a
  // visible disc on the wall, so it is a soft radial falloff instead — earth
  // loosened around the find, fading out with no edge of its own.
  const pocket = ctx.createRadialGradient(15, 17, 2, 16, 17, 20);
  pocket.addColorStop(0,   'rgba(0,0,0,.34)');
  pocket.addColorStop(0.55,'rgba(0,0,0,.20)');
  pocket.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = pocket;
  ctx.fillRect(-6, -5, 44, 44);
  // a thin lip of upcast soil catching the light on the upper left
  ctx.beginPath();
  ctx.ellipse(15, 16, 15, 12.5, -0.2, Math.PI * 0.75, Math.PI * 1.75);
  ctx.strokeStyle = 'rgba(255,224,178,.09)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

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
  // How much room a sprite has before it runs into the shaft. Finds sit in the
  // ground beside the hole, never over it.
  const gutter = Math.max(0, shaftX - 22);

  for (let si = 0; si < STRATA.length; si++) {
    const s = STRATA[si];
    const y = depthToY(s.ft) - camY;
    if (y < -90 || y > h + 90) continue;

    const side = (si % 2) === 0;
    const tx = side ? 18 : w - 18;
    const major = s.kind === 'major';
    const find = s.kind === 'find';
    // Only reveal what you have actually dug past. Everything below the
    // digger stays hidden — the descent should uncover things, not list them.
    if (diggerY < s.ft - 0.01) continue;

    // The find sits just outside the shaft wall, in the ground. Big enough to
    // actually read as an object — a pot, a road, a mammoth — because the
    // object IS the label. The old 40px sprites needed a caption to be
    // identifiable, which is exactly the crutch we are removing.
    if (s.icon) {
      // Sprites alternate sides, so the only thing a find can collide with is
      // the entry two along. On the log scale the shallow finds (3/7/13/16/20ft)
      // bunch up, and at full size they overlapped into a pile of junk — so each
      // one is capped by the room between its same-side neighbours.
      let room = Infinity;
      for (const j of [si - 2, si + 2]) {
        const n = STRATA[j];
        if (n) room = Math.min(room, Math.abs(depthToY(n.ft) - depthToY(s.ft)));
      }
      const size = Math.max(34, Math.min(major ? 132 : 104, gutter * 0.86, room * 0.92));
      const ix = side ? shaftX - size - 14 : shaftX + shaftW + 14;
      drawSprite(s.icon, ix, y - size / 2, size, s.ft);
    }

    // Text is now the exception, not the rule. Ordinary finds speak for
    // themselves; only the headline depths and the wordless layer bands (which
    // have no sprite to look at) get a line. This is what kills the wall of
    // prose running down both margins.
    const captioned = major || (!find && !s.icon);
    if (!captioned) continue;
    if (w < 560 && !major) continue;

    // Layer bands are the quiet ones — they mark a change in the ground, not a
    // thing you found. Majors are landmarks and get the amber.
    ctx.font = major ? '500 13px "DM Mono", monospace' : '400 11px "DM Mono", monospace';
    ctx.textAlign = side ? 'left' : 'right';
    // A drop shadow rather than more opacity: the labels sit on busy, varying
    // soil, and raising alpha alone still loses them against the lighter grit.
    ctx.shadowColor = 'rgba(0,0,0,.95)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = major ? 'rgba(255,214,126,1)' : 'rgba(216,196,166,.7)';
    ctx.fillText(s.text, tx, y);

    // depth tag + tick
    ctx.font = '9px "DM Mono", monospace';
    ctx.fillStyle = major ? 'rgba(255,214,126,.95)' : 'rgba(216,196,166,.55)';
    ctx.fillText(ft(s.ft), tx, y + 13);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = major ? 'rgba(255,214,126,.8)' : 'rgba(224,200,160,.35)';
    ctx.fillRect(side ? 18 : w - 66, y + 20, 48, major ? 2 : 1);
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

  // A vignette keeps the centre readable, but at .70 it ate the strata and the
  // finds along with the glare. Pulled back so the edges of the dig stay legible
  // — the text has its own scrim behind it and does not need the whole frame
  // darkened to be read.
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 1.02);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.42)');
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

/* The HUD band has room for a few words, and the strata prose does not fit —
   a hard slice at 34 chars cut entries mid-word ("STILL DRIN"). Entries carry
   a `short` for this readout; anything without one falls back to the clause
   before the first dash or full stop, which is where these lines break anyway. */
function currentStratum(f) {
  let cur = STRATA[0];
  for (const s of STRATA) if (f >= s.ft) cur = s;
  const label = cur.short || cur.text.split(/\s+[—.]\s*|[.]\s+/)[0];
  return label.toUpperCase().slice(0, 34);
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
  // renderDone re-adds this; clearing here keeps the results panel from
  // bleeding into the next run's play screens.
  stage.classList.remove('results');
  ({ intro: renderIntro, play: renderPlay, verdict: renderVerdict, done: renderDone })[state.screen]();
}

function renderIntro() {
  stage.innerHTML = `
    <h1 class="prompt">STRATA</h1>
    <p class="intro-copy">
      Name one thing nobody else would.
    </p>
    <p class="intro-foot">SEVEN PROMPTS · 25 SECONDS EACH · ${ft(BEDROCK)} TO THE BOTTOM</p>
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
        <p class="deeper-k">${last.tier === 'unlisted' || last.tier === 'unverified' ? '' : 'DEEPER FROM HERE'}</p>
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
  // The question above the answer, not just the answer. Reading back a bare
  // list of words tells you nothing about which prompt produced them.
  const rows = state.log.map((e) => `
    <div class="row ${e.pts >= 60 ? 'big' : ''}">
      <p class="q">${esc(e.q)}</p>
      <div class="ans">
        <span class="a">${e.answer ? esc(e.answer) : '—'}</span>
        <span class="p">${e.label} +${e.pts}</span>
      </div>
    </div>`).join('');

  stage.classList.add('results');
  stage.innerHTML = `
    <p class="eyebrow">FINAL DEPTH</p>
    <p class="final">${ft(depth)}</p>
    <p class="finalsub">${esc(landmark(depth))}</p>
    <p class="beat">${esc(percentileLine(state.score))}</p>
    <p class="finalsub2">${esc(closing(state.score))}</p>
    <div class="tape">${rows}</div>
    <div class="rowbtns">
      <button id="again">DIG AGAIN</button>
      <button class="ghost" id="share">COPY RESULT</button>
    </div>
  `;
  document.getElementById('again').onclick = begin;
  document.getElementById('share').onclick = async (ev) => {
    try {
      await navigator.clipboard.writeText(resultText(depth));
      ev.target.textContent = 'COPIED';
      setTimeout(() => { ev.target.textContent = 'COPY RESULT'; }, 1500);
    } catch {
      ev.target.textContent = 'COPY BLOCKED';
    }
  };
}

const MARKS = { none: '·', surface: '▁', tooclever: '▂', common: '▄', good: '▆', unverified: '▆', deep: '▇', unlisted: '█' };

/* Two blocks: the spoiler-free brag line to paste anywhere, then the full
   transcript. The transcript is the part that lets a bad prompt be found and
   fixed — a bar chart alone tells you a round went badly but never which
   question did it, or what the player actually typed. */
function resultText(depth) {
  const marks = state.log.map((x) => MARKS[x.tier]).join('');
  const beat = percentileLine(state.score);
  const rounds = state.log.map((e, i) => [
    `${i + 1}. ${e.q}`,
    `   → ${e.answer || '(no answer)'}  ·  ${e.label} +${e.pts}`,
  ].join('\n')).join('\n');

  return [
    `STRATA — ${ft(depth)} of ${ft(BEDROCK)}`,
    marks,
    landmark(depth),
    beat,
    '',
    rounds,
  ].join('\n');
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

/* "Better than 78% of today's players."
 *
 * There is no server, so this is modelled, not measured — and the model is
 * built from the one thing we do know: the prompt data itself. Each prompt's
 * tier lists are cut at real prevalence bounds, so a random player's answer
 * lands in each tier with a known probability. Sampling seven of those and
 * summing gives a score distribution; a normal approximation of it is close
 * enough and costs nothing to evaluate.
 *
 * Per-answer distribution over {miss, surface, tooclever, common, good, deep,
 * unlisted} — weighted toward the shallow end because that is what the
 * prevalence data says people actually say.
 */
const ANSWER_DIST = [
  [0.10, 0],    // no answer / wrong
  [0.34, 10],   // topsoil
  [0.14, 15],   // too clever
  [0.26, 30],   // clay
  [0.10, 60],   // shale
  [0.04, 85],   // fossil bed
  [0.02, 100],  // bedrock
];

const POP = (() => {
  const mean = ANSWER_DIST.reduce((s, [p, v]) => s + p * v, 0);
  const varr = ANSWER_DIST.reduce((s, [p, v]) => s + p * (v - mean) ** 2, 0);
  return { mean: mean * ROUND_LENGTH, sd: Math.sqrt(varr * ROUND_LENGTH) };
})();

/** Normal CDF, Abramowitz & Stegun 26.2.17. Plenty accurate for a percentage. */
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (1.330274 * t ** 4 - 1.821256 * t ** 3
                   + 1.781478 * t ** 2 - 0.356538 * t + 0.3193815);
  return z > 0 ? 1 - p : p;
}

function percentileLine(score) {
  const pct = normCdf((score - POP.mean) / POP.sd) * 100;
  // Never claim 0% or 100% — both read as a bug, and neither is true.
  const shown = Math.min(99, Math.max(1, Math.round(pct)));
  return `Better than ${shown}% of today's players.`;
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
