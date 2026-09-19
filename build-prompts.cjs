/* build-prompts.js — regenerate the norms-derived half of the prompt bank.
 *
 *   node build-prompts.js
 *
 * Emits norms-prompts.js from two independent category-production studies.
 * Run it only when a source or the tuning below changes; the game itself
 * never reads these datasets.
 *
 * Why this exists: the hand-written tiers in prompts.js are my guesses about
 * what people commonly answer. These are measurements — participants were
 * asked to name as many members of a category as they could, and the
 * frequency of each answer IS the rarity signal the game scores on.
 *
 * Two sources, deliberately:
 *
 *   Battig & Montague (1969), via the WordPools R package. ~440 US
 *   participants, 56 categories, 5231 words, pre-filtered to freq > 1 so the
 *   one-person noise is already gone. Large sample, American spellings, but
 *   dated in places.
 *
 *   Banks & Connell (2022). ~20 UK participants, 117 categories. Small sample
 *   and a long singleton tail, but modern and much broader in category range.
 *
 * Merging them matters more than either alone. Their union roughly doubles
 * coverage (tree 57 -> 131 answers, weapon 61 -> 150), which is the whole
 * problem we are solving: the lists were too short, so correct answers kept
 * falling through to BEDROCK. And agreement between two samples taken 50
 * years apart on different continents is strong evidence an answer is real,
 * which lets us treat single-study singletons with more suspicion.
 *
 * Licences differ: Banks & Connell is CC-BY 4.0; WordPools is GPL-2. Keep
 * that in mind before licensing Strata itself.
 */

const fs = require('fs');
const path = require('path');

const CSV = path.join(__dirname, 'Referential version_Item level data.csv');
const BATTIG = path.join(__dirname, 'battig-raw.json');
const PREVALENCE = path.join(__dirname, 'prevalence.tsv');
const OUT = path.join(__dirname, 'norms-prompts.js');

/* Tiers are assigned by RANK, not by share of the top answer.
 *
 * Share-based cut-offs collapse on this data: with ~20 participants and one
 * runaway answer (oak was named by nearly everyone for "tree"), a 0.7 x max
 * threshold puts a single word in TOPSOIL and buries the rest. Ranking by
 * production frequency and splitting proportionally gives every tier a
 * playable population whatever the category's shape.
 *
 * Proportions of each category's answers, shallowest first. Weighted toward
 * the tail because that is where the game rewards you for digging. */
const SPLIT = [
  ['surface',   0.10],
  ['tooclever', 0.12],
  ['common',    0.18],
  ['good',      0.25],
  ['deep',      0.35],
];

/* Battig's category name for each prompt, where the two studies overlap.
 * Keyed by the Banks & Connell name used in USE below. */
const BATTIG_ALIAS = {
  'alcoholic drink': 'alcoholic beverage',
  'bird': 'bird',
  'chemical element': 'chemical element',
  'clothing': 'article of clothing',
  'fabric': 'kind of cloth',
  'fish': 'fish',
  'flower': 'flower',
  'fruit': 'fruit',
  'furniture': 'article of furniture',
  'gemstone': 'precious stone',
  'insect': 'insect',
  'kitchen utensil': 'kitchen utensil',
  'metal': 'metal',
  'musical instrument': 'musical instrument',
  'natural landform': 'natural earth formation',
  'part of the body': 'part of the human body',
  'religious building': 'bldg for religious servic',
  'snake': 'snake',
  'spice': 'substance to flavor food',
  'tree': 'tree',
  'vegetable': 'vegetable',
  'vehicle': 'type of vehicle',
  'weapon': 'weapon',
};

/* Categories that exist ONLY in Battig — extra prompts the UK study lacks.
 * Skipped where membership is a matter of taste (type of music, toy), tied to
 * 1969 America (elective office, military title, college), or a proper-name
 * list rather than a category (girls first name, city, state). */
const BATTIG_ONLY = {
  'four-footed animal': 'Name a four-footed animal',
  'unit of time':       'Name a unit of time',
  'unit of distance':   'Name a unit of distance',
  'type of ship':       'Name a type of ship',
  'type of fuel':       'Name a type of fuel',
  'type of footgear':   'Name a type of footwear',
  'type of human dwelling': 'Name a type of human dwelling',
  'weather phenomenon': 'Name a weather phenomenon',
  'carpenters tool':    "Name a carpenter's tool",
  'type of dance':      'Name a type of dance',
  'disease':            'Name a disease',
  'crime':              'Name a crime',
  'science':            'Name a branch of science',
  'sport':              'Name a sport',
  'occupation or profession': 'Name an occupation',
  'part of a building': 'Name a part of a building',
  'nonalcoholic beverage': 'Name a non-alcoholic drink',
  'type of reading material': 'Name a type of reading material',
  'relative':           'Name a family relative',
  'color':              'Name a colour',
};

/* Categories to publish, with the prompt wording the game shows. Anything not
 * listed here is skipped: the norms include abstract categories ("emotion",
 * "negative personal quality") whose membership is a matter of opinion, and
 * a few concrete ones too vague to score fairly. */
const USE = {
  'alcoholic drink':     'Name an alcoholic drink',
  'bird':                'Name a bird',
  'bird of prey':        'Name a bird of prey',
  'boat':                'Name a type of boat or ship',
  'body of water':       'Name a body of water',
  'breed of dog':        'Name a breed of dog',
  'building material':   'Name a building material',
  'camping equipment':   'Name a piece of camping equipment',
  'chemical element':    'Name a chemical element',
  'clothing':            'Name an item of clothing',
  'cosmetic':            'Name a cosmetic',
  'dairy product':       'Name a dairy product',
  'fabric':              'Name a fabric',
  'farm animal':         'Name a farm animal',
  'fish':                'Name a fish',
  'flower':              'Name a flower',
  'fruit':               'Name a fruit',
  'furniture':           'Name a piece of furniture',
  'gemstone':            'Name a gemstone',
  'herb':                'Name a herb',
  'insect':              'Name an insect',
  'jewellery':           'Name a piece of jewellery',
  'kitchen appliance':   'Name a kitchen appliance',
  'kitchen utensil':     'Name a kitchen utensil',
  'meat':                'Name a type of meat',
  'metal':               'Name a metal',
  'musical instrument':  'Name a musical instrument',
  'natural landform':    'Name a natural landform',
  'nut':                 'Name a nut',
  'part of the body':    'Name a part of the body',
  'part of the face':    'Name a part of the face',
  'religious building':  'Name a religious building',
  'rodent':              'Name a rodent',
  'room in a house':     'Name a room in a house',
  'snake':               'Name a snake',
  'spice':               'Name a spice',
  'string instrument':   'Name a string instrument',
  'tool':                'Name a tool',
  'tree':                'Name a tree',
  'vegetable':           'Name a vegetable',
  'vehicle':             'Name a vehicle',
  'water bird':          'Name a water bird',
  'weapon':              'Name a weapon',
  'wind instrument':     'Name a wind instrument',
};

/* Participants were asked to speak freely, so a few responses are commentary
 * rather than answers ("political speech or acts" for weapon). */
const META = /^(different|various|other|some|many|all|any)\b|\b(etc|stuff|things?|type|types|kind|kinds|sort|sorts|generic|misc)\b/i;
const SENTENCE = /\b(that|which|someone|something|you can|used for|aspects?|impact)\b/i;

/* Free-response data records what participants said, including when they were
 * wrong. These are answers the norms list under a category they do not belong
 * to — an acorn is not a tree, a jellyfish is not a fish. Dropped so the game
 * never rewards a wrong answer as if it were an obscure right one. */
const WRONG = {
  tree: ['acorn', 'conker', 'banana', 'coconut', 'bush', 'berry bush', 'leaf',
    'leaves', 'branch', 'twig', 'root', 'bark', 'wood', 'forest', 'shrub',
    'blossom', 'nut', 'pine cone', 'fruit tree', 'christmas tree', 'monkey',
    'fruit', 'mango', 'hazelnut', 'plant', 'green', 'sapling', 'coniferous',
    'grapefruit', 'honeysuckle', 'evergreen', 'deciduous', 'trunk', 'stump',
    'vine', 'moss', 'fern', 'grass', 'flower'],
  fish: ['jellyfish', 'prawn', 'prawns', 'shrimp', 'lobster', 'mussel',
    'mussels', 'clams', 'crab', 'octopus', 'squid', 'axolotl', 'whale',
    'dolphin', 'starfish', 'cold water', 'seafood', 'shellfish', 'oyster',
    'scallop', 'cuttlefish', 'sea urchin', 'newt', 'frog', 'salamander',
    'crayfish', 'smoked fish', 'gefillte', 'steak', 'tadpole', 'seal',
    'walrus', 'turtle', 'water', 'fishing'],
  fruit: ['tomato', 'cucumber', 'aubergine', 'aubergines', 'squash', 'chilli',
    'chillis', 'chillies', 'cucurbits', 'avocado', 'pepper', 'peppers',
    'courgette', 'fruit vegetables', 'pumpkin', 'olive', 'rhubarb'],
  vegetable: ['tomato', 'avocado', 'chilli', 'chillis', 'fruit'],
  spice: ['parsley', 'oregano', 'basil', 'mint', 'rosemary', 'thyme', 'sage',
    'coriander leaf', 'salt', 'spicy', 'herbs', 'bay leaf', 'dill', 'chives'],
  herb: ['salt', 'pepper', 'cumin', 'paprika', 'cinnamon', 'turmeric', 'spice'],
  insect: ['spider', 'spiders', 'scorpion', 'centipede', 'millipede', 'worm',
    'slug', 'snail', 'tick', 'mite', 'woodlouse'],
  'stinging insect': ['spider', 'scorpion', 'jellyfish', 'nettle'],
  bird: ['bat', 'butterfly', 'moth', 'insect'],
  metal: ['plastic', 'wood', 'glass', 'rubber', 'diamond', 'carbon', 'stone'],
  nut: ['coconut', 'peanut butter', 'seed', 'seeds'],

  // Battig-only categories. 1969 free response includes some answers that are
  // improvised rather than category members.
  weapon: ['book', 'germs', 'can of hairspray', 'reason', 'war', 'words',
    'shoot', 'hands', 'feet', 'fists', 'mind', 'law', 'money', 'people',
    'kill', 'arm', 'arms', 'shoes', 'shoe', 'hose', 'rope', 'fire', 'car'],
  disease: ['death', 'sickness', 'germ', 'virus', 'bacteria', 'pain', 'doctor'],
  crime: ['criminal', 'jail', 'prison', 'police', 'sin', 'law'],
  'type of fuel': ['fire', 'energy', 'heat', 'power', 'food', 'sun', 'water'],
  'unit of time': ['clock', 'watch', 'time', 'moon', 'degree', 'infinity',
    'eternity', 'night', 'lifetime'],
  'unit of distance': ['ruler', 'distance', 'space', 'measure', 'long', 'far'],
  color: ['rainbow', 'colour', 'colours', 'paint', 'crayon', 'light', 'dark'],
  relative: ['family', 'relative', 'friend', 'person', 'people', 'in-law'],
  sport: ['ball', 'game', 'team', 'play', 'exercise', 'sports'],
  'type of dance': ['dancing', 'dance', 'music', 'ballroom'],
  'occupation or profession': ['job', 'work', 'worker', 'occupation', 'profession', 'boss'],
  'four-footed animal': ['animal', 'bird', 'fish', 'snake', 'human', 'man',
    'bug', 'insect', 'spider'],
  'nonalcoholic beverage': ['drink', 'beverage', 'liquid', 'alcohol', 'beer',
    'wine', 'whiskey', 'liquor'],
};

/* Battig's source data truncated words at 18 characters, so a handful of
 * entries are cut mid-word ("scientific literat", "lieutenant command").
 * Anything that long is unusable as an answer to type. */
const TRUNCATED = 18;

/* Bare modifiers that only make sense attached to a head noun. Battig records
 * them because participants said "angel" meaning angelfish, but on their own
 * they are not answers — and worse, they would match a real answer as a
 * fragment. Category-scoped, since "black" is a fine colour but not a snake. */
const FRAGMENT = {
  fish: ['angel', 'white', 'king', 'tropical', 'rainbow', 'black', 'blue',
    'gold', 'silver', 'flying', 'large-mouth bass', 'small-mouth bass', 'sun'],
  snake: ['king', 'black', 'green', 'coral', 'water', 'garden'],
  tree: ['christmas', 'shade', 'rubber', 'tulip', 'sassafras tree'],
  'type of music': ['christmas'],
  'weather phenomenon': ['rainbow', 'sun'],
  color: [],
};

function isJunk(member, category) {
  if (META.test(member)) return true;
  if (SENTENCE.test(member)) return true;          // commentary, not an answer
  if (member.split(' ').length >= 6) return true;  // long enough to be a phrase
  if (member === category) return true;            // echoes the prompt
  if (member.length >= TRUNCATED) return true;     // cut mid-word by the source
  if ((WRONG[category] ?? []).includes(member)) return true;
  if ((FRAGMENT[category] ?? []).includes(member)) return true;
  return false;
}

/* British norms, American-leaning players: keep both spellings reachable by
 * listing the US form alongside. The game's matcher treats each entry
 * independently, so both score the same tier. */
const ALSO = {
  'aubergine': 'eggplant', 'aubergines': 'eggplant',
  'courgette': 'zucchini', 'courgettes': 'zucchini',
  'chilli': 'chili', 'chillis': 'chili', 'chillies': 'chili',
  'coriander': 'cilantro',
  'swede': 'rutabaga',
  'jumper': 'sweater',
  'candyfloss': 'cotton candy',
  'spring onion': 'green onion',
  'prawn': 'shrimp', 'prawns': 'shrimp',
  'plait': 'braid',
  'sellotape': 'scotch tape',
};

/* Some UK/US pairs are only synonyms INSIDE one category, and applying them
 * everywhere corrupts other categories. "rocket" is arugula in a greengrocer
 * and a projectile everywhere else — applied globally it put "arugula" in the
 * answer list for BOTH "Name a vehicle" and "Name a weapon". Likewise "tap" is
 * a faucet in a building but a dance step elsewhere. These need the category. */
const ALSO_IN = {
  'vegetable': { 'rocket': 'arugula' },
  'part of a building': { 'tap': 'faucet' },
};

function alsoFor(category, mem) {
  const scoped = ALSO_IN[category];
  if (scoped && scoped[mem]) return scoped[mem];
  return ALSO[mem];
}

/* Both studies, keyed by the prompt's Banks & Connell category name.
 *
 * Raw counts are not comparable across studies (440 participants vs 20), so
 * each answer carries `share` — the fraction of that study's sample who named
 * it. An answer both studies saw takes the higher share and is marked
 * confirmed, which the tiering treats as evidence it is genuinely a member. */
function parse() {
  const cats = new Map();
  const add = (cat, mem, share, study) => {
    if (!mem) return;
    const key = mem.toLowerCase().trim();
    if (isJunk(key, cat)) return;
    if (!cats.has(cat)) cats.set(cat, new Map());
    const bucket = cats.get(cat);

    /* Bucket by the form the GAME's matcher will reduce this to, so "violet"
     * and "violets" are one answer rather than two. Two spellings landing in
     * different tiers is not a cosmetic duplicate: the matcher normalises
     * both to the same string, and the deeper listing would shadow the
     * shallower one, so a TOPSOIL answer would silently score FOSSIL BED. */
    const canon = key.replace(/(?:es|s)$/, '');
    const prev = bucket.get(canon);
    if (prev) {
      prev.share = Math.max(prev.share, share);
      prev.studies.add(study);
      // Prefer the shorter surface form as the printed answer.
      if (key.length < prev.mem.length) prev.mem = key;
    } else {
      bucket.set(canon, { mem: key, share, studies: new Set([study]) });
    }
  };

  // --- Banks & Connell (UK) -------------------------------------------
  const lines = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const iCat = head.indexOf('category');
  const iMem = head.indexOf('category.member');
  const iPct = head.indexOf('prod.freq.percent');
  if (iCat < 0 || iMem < 0 || iPct < 0) throw new Error('unexpected CSV columns');

  for (const line of lines.slice(1)) {
    const f = line.split(',');           // verified: no quoted fields in this file
    const cat = f[iCat], pct = Number(f[iPct]);
    if (!USE[cat] || !Number.isFinite(pct)) continue;
    add(cat, f[iMem], pct, 'uk');
  }

  // --- Battig & Montague (US) -----------------------------------------
  const battig = JSON.parse(fs.readFileSync(BATTIG, 'utf8'));
  const maxByCat = new Map();
  for (const r of battig) {
    maxByCat.set(r.cat, Math.max(maxByCat.get(r.cat) ?? 0, r.freq));
  }
  // Reverse the alias map, plus the Battig-only prompts.
  const toPrompt = new Map();
  for (const [ukCat, batCat] of Object.entries(BATTIG_ALIAS)) toPrompt.set(batCat, ukCat);
  for (const batCat of Object.keys(BATTIG_ONLY)) toPrompt.set(batCat, batCat);

  for (const r of battig) {
    const cat = toPrompt.get(r.cat);
    if (!cat) continue;
    // Battig reports raw counts; express as a share of its own top answer so
    // the scale matches the UK percentages closely enough to rank together.
    const share = (r.freq / maxByCat.get(r.cat)) * 100;
    add(cat, r.word, share, 'us');
  }

  // Map -> array, and record how many studies saw each answer.
  const out = new Map();
  for (const [cat, bucket] of cats) {
    out.set(cat, [...bucket.values()].map((v) => ({
      mem: v.mem,
      share: v.share,
      confirmed: v.studies.size > 1,
    })));
  }
  return out;
}

/* ------------------------------------------------------------ prevalence
 * Word prevalence: the proportion of people who report KNOWING a word, from
 * Brysbaert, Mandera, McCormick & Keuleers (2019), ~220,000 participants.
 *
 * Why the tiering needs a second signal. With ~20 UK participants, more than
 * half of every category's answers were named by exactly ONE person, so their
 * production shares are all identical (0.05). Ranking cannot separate them,
 * and the alphabetical tie-break then decided who landed in FOSSIL BED: "rake"
 * and "machete" scored 85 points because R and M sort late.
 *
 * Prevalence breaks those ties with a real measurement. Among answers nobody
 * else said, the ones almost everyone KNOWS (rake, cowboy, waitress) are
 * common words that merely went unsaid by a small sample; the ones few people
 * know (pestle, mangosteen) are genuinely obscure. Production frequency says
 * how often an answer is REACHED FOR; prevalence says how widely it is KNOWN.
 * Neither alone is enough — together they rank the singleton tail honestly.
 *
 * Coverage is partial (single-word English lemmas only), so this refines the
 * ranking where it can and leaves it untouched where it cannot. */
let prevalence = null;
function loadPrevalence() {
  if (prevalence) return prevalence;
  prevalence = new Map();
  if (!fs.existsSync(PREVALENCE)) {
    console.warn('! prevalence.tsv missing — singleton tail will not be reordered');
    return prevalence;
  }
  const lines = fs.readFileSync(PREVALENCE, 'utf8').split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const [w, p] = lines[i].split('\t');
    const n = Number(p);
    if (w && Number.isFinite(n)) prevalence.set(w.toLowerCase(), n);
  }
  return prevalence;
}

/* How widely an answer's word is known, or null if these norms don't cover it.
 * Multi-word answers take the rarest word in the phrase: "lodgepole pine" is
 * gated by "lodgepole". */
function knownness(mem) {
  const prev = loadPrevalence();
  const key = mem.toLowerCase().trim();
  if (prev.has(key)) return prev.get(key);

  const words = key.split(/[\s-]+/).filter(Boolean);
  if (words.length > 1) {
    const vals = words.map((w) => prev.get(w)).filter((v) => v !== undefined);
    // Only trust a phrase reading when every word was found; a partial match
    // says nothing about the words we could not look up.
    if (vals.length === words.length) return Math.min(...vals);
  }
  return null;
}

/* ------------------------------------------------------------- exclusions
 *
 * The norms are RAW PARTICIPANT RESPONSES, and participants under a 60-second
 * timer say things that are not category members. Until now every one of those
 * shipped as a scorable answer, which produced three distinct defects:
 *
 *   1. WRONG CATEGORY. "platypus" and "eagles" were listed water birds;
 *      "arugula" was a listed vehicle AND a listed weapon; "scorpions" an
 *      insect; "cockroach" a rodent. A player naming the correct thing could
 *      score less than one naming a mammal.
 *
 *   2. NOT AN ANSWER AT ALL. Evaluative or associative words the participant
 *      free-associated rather than named: "bad" and "booze" as alcoholic
 *      drinks, "ugly"/"dangerous"/"crawl" as snakes, "go"/"stop"/"beak" as
 *      birds, "punishment" and "war" as crimes.
 *
 *   3. THE CATEGORY WORD ITSELF. "spices" for spice, "ship" for type of ship,
 *      "boat" for boat — a tautology that pays points for restating the prompt.
 *
 * These are judged PER CATEGORY, not globally, because the same word can be a
 * real member of one category and junk in another: "water" is a real body of
 * water but not a real type of ship; "father" and "sister" are real family
 * relatives but not real occupations; "level" and "box" are real carpenter's
 * tools but not real parts of a building. A global blocklist gets these wrong
 * in both directions, so each entry below names the category it applies to.
 *
 * Only clear defects are listed. Debatable members are LEFT IN — the norms are
 * evidence of what people actually say, and this filter exists to remove what
 * is indefensible, not to impose taste. */
const EXCLUDE = {
  'Name an alcoholic drink': ['bad', 'booze', 'soda', 'tiger', 'tonic', 'mixers', 'shots', 'spirits', 'liquor', 'cocktail', 'mixed drinks', 'alcohol'],
  'Name a bird': ['wing', 'feet', 'run', 'eye', 'beak', 'go', 'stop', 'feathers', 'vulcan', 'phoenix', 'mockingjay'],
  'Name a bird of prey': ['chick', 'chicken', 'dove', 'pigeon', 'seagull', 'crow', 'turkey', 'robin', 'duck', 'pelican', 'blackbird'],
  'Name a type of boat or ship': ['boat people', 'lifeguard', 'transport', 'casual boat', 'floating markets'],
  'Name a body of water': ['ice', 'fish tank', 'tank', 'glass of water', 'trickle', 'tsunami', 'iceberg', 'droplets of water', 'icy comets', 'frozen moon', 'europa', 'banks', 'dams'],
  'Name a building material': ['hammer', 'nails', 'shovel', 'screwdriver', 'paste'],
  'Name a piece of camping equipment': ['food', 'fire', 'sheet', 'book', 'wood', 'wheel hub', 'chairs', 'pads'],
  'Name a chemical element': ['water', 'acid', 'alcohol', 'base', 'oil', 'salt', 'gas', 'ammonia', 'h2o', 'carbon dioxide', 'carbon monoxide', 'sodium chloride', 'nitric acid', 'sulfuric acid', 'hydrochloric acid', 'zinc oxide', 'peroxide', 'dioxide', 'nitrate', 'sulfate', 'chloride', 'bromide', 'fluoride', 'hydrochloride', 'cyanide', 'nitroglycerin', 'glycerin', 'freon', 'ferric', 'ion', 'alkaline', 'bronze', 'geranium', 'selidium', 'phosphorous'],
  'Name a cosmetic': ['surgery', 'hair', 'mirror', 'soap', 'drug', 'implants', 'nails'],
  'Name a dairy product': ['chocolate', 'eggs', 'biscuit', 'cake', 'bread', 'icing', 'cadbury'],
  'Name a fabric': ['rag', 'rough', 'soft', 'sheet', 'towel', 'yarn', 'thread', 'cloth', 'plastic', 'knit', 'sheer', 'whipped cream', 'dustcloth', 'dishcloth', 'tablecloth', 'loin', 'upc', 'sequins', 'elastic', 'synthetics', 'plastic leather'],
  'Name a farm animal': ['dog', 'cat', 'fish', 'rabbit', 'hamsters', 'sheepdog'],
  'Name a fish': ['porpoise', 'clam', 'sea horse', 'horse', 'zebra', 'tiger', 'rock', 'spot', 'hack', 'northern', 'sucker', 'lox', 'krill'],
  'Name a flower': ['wild', 'pretty', 'bloom', 'garden', 'pink', 'snowball', 'petal', 'flag', 'posy', 'clover'],
  'Name a fruit': ['nut', 'berry', 'melon'],
  'Name a piece of furniture': ['television', 'radio', 'stereo', 'hi-fi', 'picture', 'mirror', 'refrigerator', 'stove', 'ashtray', 'vase', 'computer', 'freezer', 'sink', 'clock', 'lights', 'door', 'fireplace', 'drapes', 'curtains', 'cushion', 'pillow', 'tv', 'cooker', 'phonograph', 'record player'],
  'Name a gemstone': ['gem', 'jewel', 'gold', 'silver', 'platinum', 'granite', 'marble', 'uranium', 'rhinestone', 'cameo', 'amherst', 'crystal'],
  'Name a herb': ['garlic', 'marijuana', 'soft bodied plant', 'oregon', 'chilli', 'chili', 'five spice', 'curry mint'],
  'Name an insect': ['spider', 'tarantula', 'black widow', 'scorpions', 'leech', 'snake', 'rodent', 'daddy longlegs', 'daddy-long-legs', 'thousand-legger', 'larvae', 'silverfork', 'silver bug', 'pill bug', 'stick fly', 'witchetty grub'],
  'Name a piece of jewellery': ['diamond', 'jade', 'ruby', 'sapphire', 'gold', 'silver', 'gold teeth', 'piercing', 'nose piercing', 'ear piercing', 'facial piercings', 'headbands', 'hairpiece'],
  'Name a kitchen appliance': ['spoon', 'fork', 'knife', 'plate', 'bowl', 'pot', 'pan', 'table', 'fan', 'tin foil', 'cling film', 'baking paper', 'cupboards', 'cutlery', 'washing machine', 'dryer', 'exhaust', 'flan', 'cake plate', 'cake fork', 'fish fork', 'soup spoon', 'wooden spoon', 'tablespoon', 'teaspoon', 'dessert spoon', 'chopping board', 'pan lids', 'cake tin', 'temperature gauge'],
  'Name a kitchen utensil': ['food', 'table', 'clock', 'towel', 'sheet', 'sponge', 'broom', 'dustpan', 'cabinets', 'freezer', 'refrigerator', 'ice box', 'sink', 'range', 'stove', 'oven', 'dishwasher', 'washrag', 'dishrag', 'plastic boxes', 'tupperware'],
  'Name a type of meat': ['dead animal', 'white meat', 'red meat', 'seafood', 'pig product', 'reprocessed meat', 'slabs of beef', 'sausage roll', 'chicken puree', 'pasties', 'vale', 'cow', 'sheep', 'goat', 'deer', 'frog', 'horse', 'zebra', 'crocodile', 'ostrich', 'pigeon', 'rabbit', 'kangaroo'],
  'Name a metal': ['ore', 'alloy', 'car', 'wire', 'good conduct', 'medal of honor', 'purple heart', 'argon', 'boron', 'sulfur', 'phosphorus', 'solder'],
  'Name a musical instrument': ['voice', 'human voice', 'soprano', 'alto', 'tenor', 'basso', 'vibes', 'percussion'],
  'Name a natural landform': ['water', 'stone', 'tree', 'grass', 'plant', 'flowers', 'dirt', 'soil', 'sand', 'clay', 'coal', 'mineral', 'chemicals', 'dust', 'pebbles', 'boulder', 'earthquake', 'fossil', 'land', 'ground', 'bank', 'field', 'hole', 'ditch', 'geographical land', 'guper', 'limestone', 'sandstone', 'reservoirs', 'quarries', 'rocky mountains', 'smoky mountains', 'grand canyon'],
  'Name a nut': ['roasted', 'salted', 'raisin', 'praline'],
  'Name a part of the face': ['hair', 'neck', 'skin', 'beard', 'moustache', 'spots'],
  'Name a religious building': ['house', 'home', 'school', 'building', 'hall', 'auditorium', 'foundation', 'cross', 'mass', 'priest', 'islam', 'christianity', 'pews', 'oracle', 'meeting hall', 'assembly hall', 'funeral home', 'mecca', 'tent'],
  'Name a rodent': ['cockroach', 'ferret', 'rabbit', 'bats', 'mole', 'weasel', 'snails', 'ant', 'raccoon', 'wombat', 'fleas', 'maggots', 'slugs'],
  'Name a room in a house': ['cupboard', 'boiler', 'balcony', 'entrance', 'reception', 'diner'],
  'Name a snake': ['poison', 'long', 'bite', 'crawl', 'coil', 'ugly', 'dangerous', 'venomous', 'venom', 'nonpoisonous', 'reptile', 'lizard', 'worm', 'eel', 'rat', 'cow', 'tiger', 'ring', 'diamond', 'vine', 'rock', 'brown', 'grass', 'milk', 'bull', 'corn', 'black panther', 'black jacket', 'albino', 'slover', 'serpent'],
  'Name a spice': ['sugar', 'ketchup', 'onions', 'spices', 'butter', 'chocolate', 'vinegar', 'lemon', 'mayonnaise', 'sauce', 'wine', 'oil', 'cheese', 'lime', 'orange', 'relish', 'rum', 'milk', 'cherry', 'alcohol', 'artificial', 'charcoal', 'mushroom', 'apple', 'bacon', 'barley', 'coconut', 'maple', 'pineapple', 'strawberry', 'syrup', 'dressing', 'gravy', 'saccharin', 'salad dressing', 'soy sauce', 'steak sauce', 'anchovies', 'cream', 'extract', 'butterscotch', 'eggs', 'food coloring', 'green pepper', 'margarine', 'raspberry', 'tartar sauce', 'vegetable oil', 'walnut', 'barbecue sauce', 'brandy', 'celery', 'coffee', 'flour', 'seasoning', 'accent', 'a.1. sauce', 'tobasco sauce', 'horseradish', 'maise', 'meat tenderizer', 'tenderizer', 'almond'],
  'Name a string instrument': ['piano', 'electric piano', 'acoustic piano', 'flute', 'oboe', 'clarinet'],
  'Name a tool': ['pen', 'paper', 'ball', 'books', 'calculators', 'forks', 'nuts', 'pencils', 'rulers', 'spoons', 'knife', 'spatula', 'mortar', 'cement mixer', 'digger', 'peeler'],
  'Name a tree': ['ivy', 'conifer', 'versailles', 'gum', 'plane', 'damson', 'huckleberry', 'rosewood', 'zebrawood', 'basswood', 'beechwood', 'ironwood', 'pernambuco'],
  'Name a vegetable': ['peanut', 'rice', 'pear', 'watermelon', 'pickle', 'sauerkraut', 'baked beans', 'succotash', 'greens', 'parsley', 'horseradish', 'rhubarb', 'mushroom'],
  'Name a vehicle': ['feet', 'hands', 'ride', 'horse', 'arugula', 'elevator', 'skates', 'roller skates', 'skis', 'surfboard', 'skateboard', 'skate baord', 'skate boarding', 'honda', 'ford', 'chevrolet', 'cadillac', 'buick', 'volkswagen', 'jaguar', 'mustang', 'corvair', 'falcon', 'triumph', 'yamaha', 'mg', 'oldsmobile', 'pontiac', 'caddy', 'el', 'lawn mower', 'wheelbarrow', 'barrow', 'cable car', 'sled', 'dogsled', 'raft', 'balloon', 'cycle'],
  'Name a water bird': ['platypus', 'eagles', 'hummingbird', 'drake', 'cygnet', 'shag', 'goldeneye', 'teal', 'turnstone', 'kingfisher'],
  'Name a weapon': ['poison', 'stone', 'glass', 'metal', 'hand', 'foot', 'rock', 'chair', 'boat', 'airplane', 'automobile', 'scarf', 'pin', 'hat pin', 'bottle', 'candlestick', 'gas', 'acid', 'judo', 'muscles', 'nail', 'scissors', 'screwdriver', 'wrench', 'shovel', 'pipe', 'lead pipe', 'iron bar', 'crowbar', 'brick', 'fork', 'cane', 'bat', 'baseball bat', 'rod', 'blade', 'letter opener', 'war on drugs', 'war on poverty', 'war on want', 'lightsabre', 'phaser', 'dandao', 'tank', 'fighter plane', 'chain', 'piano wire'],
  'Name a wind instrument': ['windpipe', 'vuvuzela'],
  'Name a four-footed animal': ['baby', 'turtle', 'lizard', 'frog', 'crocodile', 'alligator', 'salamander', 'dinosaur', 'ape', 'monkey', 'gorilla', 'chimpanzee', 'platypus', 'rodent', 'cattle', 'wild beast', 'jackass', 'ass'],
  'Name a unit of time': ['afternoon', 'evening', 'moment', 'age', 'generation', 'period', 'a.d.', 'b.c.', 'half hour', 'half minute', 'quarter hour', 'ten minutes', 'twenty-four hours', 'one-tenth second', 'split second', 'score'],
  'Name a unit of distance': ['acre', 'kilogram', 'milligram', 'liter', 'square', 'square yard', 'square foot', 'square inch', 'square mile', 'degree', 'knot', 'block', 'step', 'pace', 'length', 'measured in time', 'half mile', 'half inch', 'quarter inch', 'quarter mile'],
  'Name a type of ship': ['ship', 'boat', 'water', 'air', 'oil', 'atomic', 'diesel', 'friend', 'private', 'repair', 'supply', 'navy', 'naval', 'transport', 'passenger', 'cargo', 'fishing', 'pleasure', 'airplane', 'spaceship', 'rocket ship', 'flag', 'ship of state', 'tub', 'bark', 'junk', 'queen mary', 'ironsides'],
  'Name a type of fuel': ['air', 'water power', 'regular', 'liquid', 'combustion', 'sunlight', 'calories', 'grass', 'leaves', 'sugar', 'wax', 'paper', 'oxygen', 'nitrogen', 'liquid oxygen', 'liquid nitrogen', 'helium', 'peroxide', 'hydrogen peroxide', 'carbon chloride', 'esso', 'gulf', 'sunoco', 'amoco', 'lox'],
  'Name a type of footwear': ['socks', 'stockings', 'nylons', 'hose', 'hosiery', 'leotards', 'peds', 'anklet', 'barefoot', 'brace', 'cast', 'clutch', 'brake', 'gas', 'pedal', 'leather', 'shoelace', 'shoestring', 'skis', 'snow skis', 'water skis', 'skates', 'ice-skates', 'roller skates', 'flippers', 'swim fins', 'spikes'],
  'Name a type of human dwelling': ['money', 'box', 'tree', 'hole', 'cliff', 'car', 'boat', 'ship', 'train', 'garage', 'barn', 'hospital', 'prison', 'office', 'open air', 'two-story', 'pad'],
  'Name a weather phenomenon': ['hot', 'cold', 'warm', 'clear', 'calm', 'dry', 'fair', 'humid', 'mild', 'sunny', 'rainy', 'foggy', 'high', 'low', 'front', 'pressure', 'high pressure', 'low pressure', 'temperature', 'thermometer', 'barometer', 'weather vane', 'earthquake', 'volcano eruption', 'avalanche', 'ice', 'heat', 'clear sky', 'pour', 'dampness', 'glaze', 'slush', 'eclipse'],
  "Name a carpenter's tool": ['wood', 'board', 'cement', 'brick', 'nails', 'screws', 'bolts', 'nuts', 'washer', 'tack', 'glue', 'string', 'chalk', 'blueprints', 'pencil', 'scissors', 'box', 'triangle', 'angle', 'measure', 'balance', 'slide rule', 'bench', 'ladder', 'sawhorse', 'anvil', 'lever', 'wedge', 'shaver', 'measurer', 'scriber', 'punch'],
  'Name a type of dance': ['slow', 'fast', 'social', 'popular', 'walk', 'hop', 'bob', 'dog', 'bird', 'fish', 'mouse', 'frog', 'chicken', 'snake', 'bug', 'fly', 'potato', 'faucet', 'shotgun', 'eight-one', 'bodie', 'jack the ripper', 'uncle willie', 'elephant walk', 'siamese', 'russian', 'interpretive', 'modern', 'swim', 'surf', 'stomp', 'shuffle', 'belly', 'tap'],
  'Name a disease': ['bad', 'cold', 'cough', 'fever', 'sore throat', 'liver', 'lung', 'thyroid', 'coronary', 'stroke', 'paralysis', 'allergy', 'fungus', 'consumption', 'mental illness', 'neurosis', 'alcoholism', 'tumors', 'varicose veins', 'kidney disease', 'heart disease'],
  'Name a crime': ['punishment', 'war', 'bank', 'lying', 'cheating', 'lust', 'attack', 'beating', 'fighting', 'destruction', 'discrimination', 'homosexuality', 'sodomy', 'adultery', 'fornication', 'incest', 'abortion', 'suicide', 'confidence', 'felony', 'misdemeanor', 'stealing', 'killing', 'rob a bank', 'peddling', 'dope peddling', 'litter-bugging'],
  'Name a branch of science': ['earth', 'social', 'medicine', 'engineering', 'philosophy', 'astrology', 'history', 'architecture', 'agriculture', 'dentistry', 'pharmacy', 'nutrition', 'electronics', 'general science', 'physical science'],
  'Name a sport': ['pool', 'chess', 'checkers', 'cards', 'girls', 'field', 'apparatus', 'camping', 'fishing', 'hunting', 'shooting', 'racing', 'riding', 'dancing', 'hiking', 'flicker ball', 'speedball', 'speedaway', 'tumbling', 'pole vault'],
  'Name an occupation': ['father', 'sister', 'mister', 'mrs.', 'sir', 'title', 'position', 'labor', 'military', 'leader', 'master', 'owner', 'chief', 'king', 'private', 'major', 'general', 'colonel', 'lieutenant', 'sergeant', 'captain', 'indian chief', 'candlestick maker', 'thief', 'drifter', 'housewife', 'student', 'blue collar', 'real estate', 'car driver', 'driver', 'baby'],
  'Name a part of a building': ['people', 'furniture', 'chairs', 'desk', 'carpet', 'rug', 'shade', 'blackboard', 'drinking fountain', 'metal', 'stone', 'glass', 'wood', 'cement', 'brick', 'concrete', 'steel', 'mortar', 'nails', 'boards', 'lumber', 'paint', 'plaster', 'insulation', 'block', 'level', 'section', 'front', 'back', 'rear', 'side', 'inside', 'outside', 'flight', 'exit', 'lock', 'cable', 'rod', 'structure', 'framework'],
  'Name a non-alcoholic drink': ['water', 'lemon', 'lime', 'cherry', 'chocolate', 'soup', 'malt', 'like', 'ale', 'eggnog', 'cider', 'cream', 'bouillon', 'ade', 'phosphates', 'tang'],
  'Name a type of reading material': ['sheet', 'card', 'label', 'sign', 'look', 'time', 'mad', 'news', 'music', 'cartoon', 'notebook', 'folder', 'reference', 'literature', 'fiction', 'nonfiction', 'classics', 'drama', 'poetry', 'history', 'prose', 'theme', 'volume', 'story', 'jokes', 'instructions', 'dittoed sheet', 'newsweek', 'playboy', 'racing form'],
  'Name a family relative': ['children', 'parents', 'grandparents', 'in-laws'],
  'Name a colour': ['blond', 'auburn', 'flesh', 'cranberry', 'orchid', 'lemon', 'ruby', 'tangerine', 'peach', 'salmon', 'amber', 'ivory', 'cream', 'gold', 'silver', 'emerald', 'rose'],
};

/* Strip the category's own name, which participants restate under time
 * pressure ("spices" for spice, "ship" for type of ship). Scoring points for
 * echoing the prompt is the purest form of the defect. */
function isTautology(question, mem) {
  const subject = question.replace(/^Name (a|an|the) /i, '').toLowerCase().trim();
  const m = mem.toLowerCase().trim();
  if (m === subject) return true;
  // "type of ship" -> "ship"; "piece of jewellery" -> "jewellery"
  const head = subject.replace(/^(type|piece|kind|branch|part|unit) of /, '');
  return m === head || m === head + 's' || m + 's' === head;
}

function excluded(question, mem) {
  const list = EXCLUDE[question];
  const m = mem.toLowerCase().trim();
  if (list && list.includes(m)) return true;
  return isTautology(question, mem);
}

/* Answers this thinly attested are indistinguishable from each other by
 * production frequency alone — one person in twenty. Above this, the share
 * ordering is real data and prevalence must not override it. */
const SINGLETON = 0.051;

/* An unknown word is assumed moderately obscure rather than maximally so:
 * uncovered answers are usually proper nouns or compounds, not necessarily
 * rare. This keeps them mid-tail instead of sweeping them all into DEEP. */
const UNKNOWN_PREVALENCE = 0.80;

function tierise(members, category) {
  /* Most-named first. Within the singleton tail — where production frequency
   * has no resolving power — order by how widely the word is known, rarest
   * first, so genuinely obscure answers sink to the deeper tiers and common
   * words that simply went unsaid rise toward the shallower ones.
   *
   * Alphabetical remains the final tie-break so rebuilds stay reproducible. */
  const sorted = [...members].sort((a, b) => {
    if (b.share !== a.share) return b.share - a.share;
    if (a.share <= SINGLETON && b.share <= SINGLETON) {
      const ka = knownness(a.mem) ?? UNKNOWN_PREVALENCE;
      const kb = knownness(b.mem) ?? UNKNOWN_PREVALENCE;
      // Higher knownness = shallower. Sorts descending, like share.
      if (ka !== kb) return kb - ka;
    }
    return a.mem.localeCompare(b.mem);
  });
  const out = { surface: [], tooclever: [], common: [], good: [], deep: [] };
  const seen = new Set();

  // Tier boundaries by position in the ranking.
  const n = sorted.length;
  const bounds = [];
  let acc = 0;
  for (const [tier, share] of SPLIT) {
    acc += share * n;
    bounds.push([tier, Math.round(acc)]);
  }

  sorted.forEach(({ mem }, i) => {
    let tier = bounds.find(([, limit]) => i < limit)?.[0] ?? 'deep';
    tier = capByKnownness(mem, tier);
    for (const word of [mem, alsoFor(category, mem)]) {
      if (!word || seen.has(word)) continue;
      seen.add(word);
      out[tier].push(word);
    }
  });
  return out;
}

/* The proportional split assumes every category HAS obscure members. Many do
 * not. Asked to name an occupation, people produce doctor, teacher, waiter,
 * welder, author — a long list of words essentially everyone knows. The split
 * still hands its bottom 35% to DEEP, so "waitress" paid 85 of 100 points for
 * being alphabetically late among equally-common words.
 *
 * So a tier is a ceiling, not a guarantee: an answer may be demoted toward the
 * surface when prevalence says it is a word nearly everyone knows, but it is
 * never promoted deeper. Rank still decides how deep an answer CAN go; this
 * only refuses to call a universally-known word genuinely obscure.
 *
 * Categories with a real spread of obscurity (tools: awl 0.75, pestle 0.84;
 * trees: alder 0.76) keep their deep tiers. Categories without one (occupation)
 * lose theirs, which is the honest outcome — their tail is not obscure, and
 * BEDROCK still rewards anything the lists never enumerated.
 *
 * Thresholds are deliberately high. Below ~0.97 a word is unknown to enough
 * people to be a fair deep answer; the cap is aimed only at the near-universal. */
const KNOWNNESS_CAP = [
  { min: 0.995, tier: 'common' },  // near-universal: waitress, owner, ivy
  { min: 0.980, tier: 'good' },    // very widely known: mahogany, announcer
];

function capByKnownness(mem, tier) {
  const ORDER = ['surface', 'tooclever', 'common', 'good', 'deep'];
  const k = knownness(mem);
  // No coverage: leave the rank-derived tier alone rather than guess.
  if (k === null) return tier;
  const rule = KNOWNNESS_CAP.find((r) => k >= r.min);
  if (!rule) return tier;
  return ORDER.indexOf(tier) > ORDER.indexOf(rule.tier) ? rule.tier : tier;
}

const cats = parse();
const entries = [];
let skipped = [];

const ALL = { ...USE, ...BATTIG_ONLY };

let dropped = 0;
const droppedBy = {};

for (const [cat, question] of Object.entries(ALL)) {
  let members = cats.get(cat);
  if (!members) { skipped.push(cat + ' (absent)'); continue; }

  /* Drop non-members BEFORE tiering. Order matters: tiers are assigned by
   * rank within the surviving list, so filtering afterwards would leave
   * holes and shift every remaining answer's tier unpredictably. */
  const before = members.length;
  members = members.filter((m) => !excluded(question, m.mem));
  const n = before - members.length;
  if (n) { dropped += n; droppedBy[question] = n; }

  /* Too few answers and the tiers cannot be filled meaningfully.
   *
   * The floor is 30, not 12. Twelve was set when non-members were inflating
   * every count, and it does not survive contact with the cleaned data: at 12
   * real answers a five-tier ladder holds 2-3 each, so the list covers so
   * little of the category that almost every correct answer a player gives is
   * unlisted. On an OPEN prompt unlisted pays UNCHARTED (8), which means
   * "beaver", "vole" and "muskrat" all scored 8 for "Name a rodent" while the
   * listed "margarine" scored 30 for "Name a dairy product" — the ladder
   * inverts against the player for naming something real.
   *
   * Thirty is where a five-tier split has ~6 per tier and the list is a
   * plausible sample of the category rather than a handful of examples.
   * Categories below it are dropped rather than shipped broken; the hand-
   * written bank in prompts.js is where small, genuinely CLOSED categories
   * belong, because there an unlisted answer is wrong rather than underpaid. */
  const FLOOR = 30;
  if (members.length < FLOOR) { skipped.push(cat + ' (only ' + members.length + ')'); continue; }
  const t = tierise(members, cat);
  // Every tier must have something, or scoring has holes.
  const empty = Object.entries(t).filter(([, v]) => v.length === 0).map(([k]) => k);
  if (empty.length) { skipped.push(cat + ' (empty: ' + empty.join(',') + ')'); continue; }
  entries.push({ q: question, cat: 'norms', ...t });
}

/* The correctness contract each generated prompt ships with.
 *
 * These used to be hand-added to norms-prompts.js AFTER generation, which is
 * exactly the fragility the file header warns about: the next rebuild silently
 * dropped all 64 of them and prompt-schema.js rejected the whole bank. They
 * belong here, where a rebuild preserves them.
 *
 * Every norms prompt is `closed: false` — these are everyday categories with
 * long real tails, so an unlisted answer is usually a real one the study never
 * recorded. `hinted` is the stricter gate, used where the category has strong
 * morphological endings that a made-up word will not match. */
const HINTS = {
  'Name a bird': 'bird',
  'Name a bird of prey': 'bird',
  'Name a chemical element': 'chemical',
  'Name a fish': 'fish',
  'Name a flower': 'plant',
  'Name a metal': 'mineral',
  'Name a tree': 'plant',
};

const body = entries.map((e) => {
  const tiers = ['surface', 'tooclever', 'common', 'good', 'deep']
    .map((k) => '    ' + k + ': ' + JSON.stringify(e[k]) + ',')
    .join('\n');
  const hint = HINTS[e.q];
  const decl = hint
    ? ', closed: false, gate: "hinted", hint: ' + JSON.stringify(hint)
    : ', closed: false, gate: "wordlike"';
  return '  { q: ' + JSON.stringify(e.q) + ', cat: "norms"' + decl + ',\n'
    + tiers.replace(/,$/, '') + ' },';
}).join('\n\n');

fs.writeFileSync(OUT, `/* GENERATED by build-prompts.js — do not edit by hand.
 *
 * Tiers are measured, not guessed: each answer's tier comes from how many of
 * ~20 UK participants named it when asked to list members of the category in
 * 60 seconds. The most-named answers are TOPSOIL; the long tail is FOSSIL BED.
 *
 * Source: Banks, B. & Connell, L. (2022). Category production norms for 117
 * concrete and abstract categories. Behavior Research Methods.
 * https://osf.io/jgcu6/ — licensed CC-BY 4.0.
 */

export const NORMS_PROMPTS = [
${body}
];
`);

console.log('categories used   :', entries.length);
console.log('answers written   :', entries.reduce((n, e) =>
  n + ['surface', 'tooclever', 'common', 'good', 'deep'].reduce((m, k) => m + e[k].length, 0), 0));
console.log('non-members cut   :', dropped);
if (skipped.length) console.log('skipped           :', skipped.join(', '));
if (process.argv.includes('--verbose')) {
  for (const [q, n] of Object.entries(droppedBy).sort((a, b) => b[1] - a[1])) {
    console.log('  cut ' + String(n).padStart(3) + '  ' + q);
  }
}
console.log('wrote', path.basename(OUT));
