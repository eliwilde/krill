/* STRATA — prompt bank
 *
 * Every prompt is a FACTUAL category with a real, finite membership. Not
 * opinion, not vibes. "Name a noodle dish" works because ramen is genuinely
 * the common answer and khao soi is genuinely obscure. "Name a drink nobody
 * orders before noon" does not work, because there's no fact of the matter.
 *
 * Six answer tiers, shallowest to deepest:
 *   surface   the answer everyone blurts out            10
 *   tooclever the one you're proud of — so is everyone  15
 *   common    solidly known                             30
 *   good      most people wouldn't reach it             60
 *   deep      genuinely obscure                         85
 *   unlisted  anything not in the lists                100
 *
 * The tooclever tier is the heart of it: the answer that feels like a
 * clever dodge is the one thousands of other players also thought was clever.
 */

export const PROMPTS = [
  // ============================ FOOD ============================
  { q: "Name a noodle dish", cat: "food",
    surface: ["ramen", "spaghetti", "pad thai", "lo mein", "mac and cheese"],
    tooclever: ["pho", "udon", "carbonara", "chow mein", "soba"],
    common: ["lasagna", "fettuccine alfredo", "yakisoba", "dan dan noodles", "japchae", "bolognese"],
    good: ["laksa", "bibim guksu", "beef chow fun", "mie goreng", "hokkien mee", "tteokbokki"],
    deep: ["khao soi", "zaru soba", "biang biang", "kuy teav", "cao lau", "pancit", "lagman", "shirataki"] },

  { q: "Name a cheese", cat: "food",
    surface: ["cheddar", "mozzarella", "parmesan", "swiss", "american"],
    tooclever: ["brie", "gouda", "feta", "blue cheese", "gorgonzola"],
    common: ["camembert", "provolone", "ricotta", "manchego", "havarti", "monterey jack"],
    good: ["gruyere", "taleggio", "comte", "pecorino", "emmental", "halloumi", "mascarpone"],
    deep: ["epoisses", "cabrales", "raclette", "morbier", "tete de moine", "caerphilly", "vacherin", "limburger"] },

  { q: "Name a spice", cat: "food",
    surface: ["cinnamon", "pepper", "salt", "paprika", "oregano"],
    tooclever: ["cumin", "turmeric", "nutmeg", "cardamom", "saffron"],
    common: ["coriander", "cloves", "ginger", "chili powder", "fennel", "allspice"],
    good: ["star anise", "sumac", "fenugreek", "mace", "juniper", "caraway", "asafoetida"],
    deep: ["grains of paradise", "nigella", "ajwain", "long pepper", "zedoary", "annatto", "galangal"] },

  { q: "Name a cut of beef", cat: "food",
    surface: ["ribeye", "sirloin", "filet mignon", "t-bone", "ground beef"],
    tooclever: ["brisket", "flank", "new york strip", "chuck", "skirt"],
    common: ["short rib", "tri tip", "hanger", "rump", "porterhouse", "round"],
    good: ["flat iron", "denver", "picanha", "oxtail", "shank", "bavette", "chuck eye"],
    deep: ["teres major", "spider steak", "merlot steak", "vegas strip", "sierra cut", "featherblade"] },

  { q: "Name a type of bread", cat: "food",
    surface: ["white bread", "sourdough", "baguette", "naan", "pita"],
    tooclever: ["focaccia", "ciabatta", "brioche", "rye", "challah"],
    common: ["cornbread", "bagel", "tortilla", "pumpernickel", "soda bread", "flatbread"],
    good: ["injera", "lavash", "roti", "panettone", "stollen", "zwieback", "arepa"],
    deep: ["borodinsky", "pandesal", "bammy", "khachapuri", "malooga", "barbari", "melonpan"] },

  // ============================ GEOGRAPHY ============================
  { q: "Name a country in Africa", cat: "geo",
    surface: ["egypt", "south africa", "kenya", "nigeria", "morocco"],
    tooclever: ["ethiopia", "ghana", "tanzania", "algeria", "uganda"],
    common: ["senegal", "zimbabwe", "sudan", "cameroon", "zambia", "tunisia", "angola"],
    good: ["burkina faso", "malawi", "benin", "gabon", "mauritania", "lesotho", "eritrea"],
    deep: ["comoros", "sao tome", "djibouti", "guinea-bissau", "burundi", "equatorial guinea", "eswatini"] },

  { q: "Name a capital city", cat: "geo",
    surface: ["paris", "london", "tokyo", "washington", "rome"],
    tooclever: ["ottawa", "canberra", "brasilia", "wellington", "bern"],
    common: ["vienna", "oslo", "lisbon", "warsaw", "nairobi", "hanoi", "helsinki"],
    good: ["tbilisi", "ljubljana", "montevideo", "asuncion", "chisinau", "vientiane", "tirana"],
    deep: ["ouagadougou", "thimphu", "nuku'alofa", "yamoussoukro", "bandar seri begawan", "port vila", "gitega"] },

  { q: "Name a river", cat: "geo",
    surface: ["nile", "amazon", "mississippi", "thames", "danube"],
    tooclever: ["yangtze", "ganges", "rhine", "volga", "seine"],
    common: ["mekong", "euphrates", "colorado", "congo", "tigris", "indus", "rio grande"],
    good: ["irrawaddy", "zambezi", "orinoco", "yukon", "brahmaputra", "murray", "loire"],
    deep: ["limpopo", "kolyma", "ob", "syr darya", "magdalena", "ussuri", "chao phraya", "tocantins"] },

  { q: "Name a mountain range", cat: "geo",
    surface: ["himalayas", "rockies", "alps", "andes", "appalachians"],
    tooclever: ["urals", "pyrenees", "sierra nevada", "atlas", "caucasus"],
    common: ["carpathians", "cascades", "apennines", "balkans", "great dividing range"],
    good: ["tian shan", "karakoram", "drakensberg", "hindu kush", "altai", "zagros", "pennines"],
    deep: ["pamirs", "annamite", "verkhoyansk", "sayan", "aravalli", "bale", "brooks range"] },

  { q: "Name an island country", cat: "geo",
    surface: ["japan", "iceland", "cuba", "ireland", "madagascar"],
    tooclever: ["new zealand", "philippines", "jamaica", "sri lanka", "indonesia"],
    common: ["fiji", "malta", "cyprus", "bahamas", "maldives", "haiti", "taiwan"],
    good: ["vanuatu", "seychelles", "comoros", "grenada", "dominica", "samoa", "tonga"],
    deep: ["kiribati", "tuvalu", "nauru", "palau", "sao tome and principe", "micronesia", "niue"] },

  // ============================ NATURE ============================
  { q: "Name a flightless bird", cat: "nature",
    surface: ["penguin", "ostrich", "emu", "kiwi", "chicken"],
    tooclever: ["dodo", "cassowary", "rhea"],
    common: ["kakapo", "takahe", "weka", "moa", "steamer duck"],
    good: ["kagu", "flightless cormorant", "inaccessible island rail", "guam rail"],
    deep: ["elephant bird", "great auk", "titicaca grebe", "campbell teal", "kiwi pukupuku"] },

  { q: "Name a venomous animal", cat: "nature",
    surface: ["snake", "scorpion", "spider", "cobra", "rattlesnake"],
    tooclever: ["box jellyfish", "black widow", "platypus", "stingray"],
    common: ["stonefish", "lionfish", "gila monster", "pufferfish", "centipede", "taipan"],
    good: ["blue-ringed octopus", "cone snail", "slow loris", "bullet ant", "hooded pitohui"],
    deep: ["irukandji", "deathstalker", "sydney funnel-web", "greater blind snake", "shrew", "solenodon"] },

  { q: "Name a big cat", cat: "nature",
    surface: ["lion", "tiger", "leopard", "cheetah", "jaguar"],
    tooclever: ["cougar", "panther", "puma", "snow leopard", "lynx"],
    common: ["bobcat", "ocelot", "caracal", "serval", "clouded leopard"],
    good: ["margay", "jaguarundi", "fishing cat", "sand cat", "pallas's cat"],
    deep: ["kodkod", "oncilla", "flat-headed cat", "marbled cat", "andean mountain cat", "rusty-spotted cat"] },

  { q: "Name a tree", cat: "nature",
    surface: ["oak", "pine", "maple", "palm", "birch"],
    tooclever: ["willow", "redwood", "sequoia", "baobab", "eucalyptus"],
    common: ["cedar", "aspen", "beech", "cypress", "sycamore", "mahogany", "elm"],
    good: ["ginkgo", "banyan", "jacaranda", "hornbeam", "tamarack", "kapok", "yew"],
    deep: ["dragon blood", "bristlecone pine", "wollemi pine", "monkey puzzle", "quiver tree", "kauri"] },

  { q: "Name a dinosaur", cat: "nature",
    surface: ["t-rex", "velociraptor", "stegosaurus", "triceratops", "brachiosaurus"],
    tooclever: ["pterodactyl", "spinosaurus", "ankylosaurus", "diplodocus", "allosaurus"],
    common: ["brontosaurus", "iguanodon", "pachycephalosaurus", "parasaurolophus", "archaeopteryx"],
    good: ["carnotaurus", "therizinosaurus", "deinonychus", "giganotosaurus", "compsognathus", "dilophosaurus"],
    deep: ["microraptor", "yutyrannus", "shunosaurus", "amargasaurus", "nigersaurus", "mononykus", "borealopelta"] },

  // ============================ SCIENCE ============================
  { q: "Name a chemical element", cat: "sci",
    surface: ["oxygen", "hydrogen", "carbon", "gold", "iron"],
    tooclever: ["helium", "neon", "uranium", "mercury", "plutonium"],
    common: ["sodium", "calcium", "zinc", "lithium", "argon", "silicon", "titanium"],
    good: ["tungsten", "cobalt", "iodine", "bismuth", "palladium", "selenium", "rubidium"],
    deep: ["yttrium", "hafnium", "praseodymium", "technetium", "dysprosium", "seaborgium", "roentgenium", "thulium"] },

  { q: "Name a bone in the human body", cat: "sci",
    surface: ["skull", "femur", "rib", "spine", "jaw"],
    tooclever: ["tibia", "humerus", "pelvis", "sternum", "clavicle"],
    common: ["fibula", "radius", "ulna", "scapula", "patella", "vertebra", "mandible"],
    good: ["metatarsal", "phalanx", "calcaneus", "sacrum", "coccyx", "hyoid", "talus"],
    deep: ["stapes", "incus", "malleus", "ethmoid", "vomer", "lunate", "pisiform", "sphenoid"] },

  { q: "Name a constellation", cat: "sci",
    surface: ["orion", "big dipper", "ursa major", "leo", "scorpio"],
    tooclever: ["cassiopeia", "andromeda", "gemini", "taurus", "pegasus"],
    common: ["draco", "lyra", "cygnus", "aquarius", "perseus", "hercules", "centaurus"],
    good: ["cepheus", "bootes", "auriga", "carina", "hydra", "corvus", "lupus"],
    deep: ["camelopardalis", "reticulum", "horologium", "microscopium", "caelum", "fornax", "norma", "antlia"] },

  { q: "Name a moon in our solar system", cat: "sci",
    surface: ["the moon", "europa", "titan", "io", "ganymede"],
    tooclever: ["callisto", "phobos", "deimos", "enceladus", "triton"],
    common: ["mimas", "rhea", "dione", "iapetus", "charon", "tethys"],
    good: ["miranda", "ariel", "umbriel", "oberon", "titania", "hyperion", "nereid"],
    deep: ["amalthea", "himalia", "phoebe", "janus", "epimetheus", "proteus", "pandora", "prometheus"] },

  { q: "Name a unit of measurement", cat: "sci",
    surface: ["meter", "inch", "pound", "gram", "mile"],
    tooclever: ["kelvin", "newton", "joule", "watt", "hertz"],
    common: ["pascal", "ampere", "candela", "mole", "ohm", "volt", "knot"],
    good: ["tesla", "weber", "siemens", "becquerel", "lumen", "sievert", "farad"],
    deep: ["furlong", "hogshead", "parsec", "poise", "gilbert", "rood", "chain", "slug", "barn"] },

  // ============================ HISTORY & CULTURE ============================
  { q: "Name an ancient civilization", cat: "hist",
    surface: ["egypt", "rome", "greece", "maya", "aztec"],
    tooclever: ["inca", "mesopotamia", "babylon", "persia", "china"],
    common: ["sumer", "carthage", "assyria", "phoenicia", "olmec", "indus valley", "byzantine"],
    good: ["hittite", "minoan", "etruscan", "nubia", "parthia", "sassanid", "mycenaean"],
    deep: ["elam", "urartu", "axum", "kush", "zapotec", "moche", "nabatean", "sogdiana", "dilmun"] },

  { q: "Name a Greek god", cat: "hist",
    surface: ["zeus", "poseidon", "hades", "athena", "apollo"],
    tooclever: ["ares", "hermes", "artemis", "aphrodite", "hera"],
    common: ["demeter", "dionysus", "hephaestus", "hestia", "persephone", "helios"],
    good: ["nyx", "hypnos", "nemesis", "hecate", "eros", "pan", "thanatos", "iris"],
    deep: ["erebus", "tartarus", "aether", "hemera", "moros", "phanes", "eurus", "asteria"] },

  { q: "Name a war", cat: "hist",
    surface: ["world war 2", "world war 1", "civil war", "vietnam war", "korean war"],
    tooclever: ["cold war", "crusades", "hundred years war", "revolutionary war", "gulf war"],
    common: ["napoleonic wars", "trojan war", "boer war", "punic wars", "thirty years war", "crimean war"],
    good: ["peloponnesian war", "war of the roses", "spanish civil war", "russo-japanese war", "six-day war"],
    deep: ["war of jenkins' ear", "chaco war", "winter war", "emu war", "pastry war", "toledo war", "banana wars"] },

  { q: "Name a musical instrument", cat: "culture",
    surface: ["guitar", "piano", "drums", "violin", "flute"],
    tooclever: ["cello", "trumpet", "saxophone", "harp", "banjo"],
    common: ["clarinet", "trombone", "accordion", "oboe", "bassoon", "ukulele", "mandolin"],
    good: ["sitar", "theremin", "bagpipes", "harpsichord", "didgeridoo", "koto", "balalaika"],
    deep: ["hurdy-gurdy", "nyckelharpa", "shakuhachi", "ondes martenot", "glass armonica", "sarrusophone", "duduk", "kora"] },

  { q: "Name a board game", cat: "culture",
    surface: ["monopoly", "chess", "checkers", "scrabble", "clue"],
    tooclever: ["risk", "catan", "battleship", "connect four", "backgammon"],
    common: ["go", "othello", "ticket to ride", "carcassonne", "pandemic", "mancala", "stratego"],
    good: ["diplomacy", "agricola", "twilight struggle", "puerto rico", "azul", "shogi", "hive"],
    deep: ["hnefatafl", "senet", "brass", "tigris and euphrates", "through the ages", "xiangqi", "go-moku", "royal game of ur"] },

  // ============================ SPORT ============================
  { q: "Name an Olympic sport", cat: "sport",
    surface: ["swimming", "running", "gymnastics", "basketball", "soccer"],
    tooclever: ["fencing", "archery", "judo", "rowing", "diving"],
    common: ["weightlifting", "boxing", "wrestling", "badminton", "taekwondo", "triathlon", "handball"],
    good: ["pentathlon", "dressage", "water polo", "trampoline", "canoe slalom", "skeleton", "luge"],
    deep: ["racewalking", "keirin", "nordic combined", "biathlon", "curling", "sport climbing", "madison", "omnium"] },

  { q: "Name a position in American football", cat: "sport",
    surface: ["quarterback", "running back", "wide receiver", "linebacker", "kicker"],
    tooclever: ["tight end", "cornerback", "safety", "punter", "center"],
    common: ["offensive tackle", "guard", "defensive end", "nose tackle", "fullback", "long snapper"],
    good: ["strong safety", "free safety", "slot receiver", "nickelback", "gunner", "h-back"],
    deep: ["dimeback", "wingback", "upback", "jack linebacker", "personal protector", "monster back"] },

  // ============================ LANGUAGE ============================
  { q: "Name a language", cat: "lang",
    surface: ["english", "spanish", "french", "chinese", "german"],
    tooclever: ["latin", "japanese", "arabic", "russian", "italian"],
    common: ["hindi", "swahili", "korean", "portuguese", "dutch", "greek", "hebrew"],
    good: ["tagalog", "farsi", "amharic", "tamil", "welsh", "basque", "quechua"],
    deep: ["tuvan", "xhosa", "faroese", "guarani", "aymara", "inuktitut", "nahuatl", "malayalam", "sami"] },

  { q: "Name a Greek letter", cat: "lang",
    surface: ["alpha", "beta", "omega", "delta", "pi"],
    tooclever: ["gamma", "sigma", "theta", "lambda", "phi"],
    common: ["epsilon", "zeta", "kappa", "mu", "rho", "tau", "chi"],
    good: ["upsilon", "xi", "omicron", "eta", "nu", "psi", "iota"],
    deep: ["digamma", "koppa", "sampi", "stigma", "heta", "san"] },

  // ============================ MYTH & FICTION ============================
  { q: "Name a mythical creature", cat: "myth",
    surface: ["dragon", "unicorn", "griffin", "mermaid", "phoenix"],
    tooclever: ["centaur", "minotaur", "kraken", "sphinx", "cyclops"],
    common: ["chimera", "hydra", "pegasus", "banshee", "troll", "yeti", "basilisk"],
    good: ["wendigo", "kelpie", "selkie", "golem", "manticore", "kitsune", "djinn"],
    deep: ["nuckelavee", "bunyip", "qilin", "encantado", "jorogumo", "alkonost", "tarasque", "baku"] },

  { q: "Name a Shakespeare play", cat: "culture",
    surface: ["romeo and juliet", "hamlet", "macbeth", "julius caesar", "othello"],
    tooclever: ["king lear", "a midsummer night's dream", "the tempest", "much ado about nothing"],
    common: ["twelfth night", "the merchant of venice", "as you like it", "richard iii", "henry v", "the taming of the shrew"],
    good: ["coriolanus", "cymbeline", "titus andronicus", "measure for measure", "pericles", "timon of athens"],
    deep: ["troilus and cressida", "king john", "the two noble kinsmen", "love's labour's lost", "edward iii", "henry viii"] },

  // ============================ MODERN ============================
  { q: "Name a programming language", cat: "tech",
    surface: ["python", "javascript", "java", "c++", "html"],
    tooclever: ["rust", "go", "ruby", "swift", "typescript"],
    common: ["php", "kotlin", "scala", "perl", "matlab", "r", "c#"],
    good: ["haskell", "elixir", "clojure", "lua", "fortran", "cobol", "erlang", "julia"],
    deep: ["prolog", "smalltalk", "ocaml", "forth", "apl", "brainfuck", "zig", "nim", "racket"] },

  { q: "Name a car manufacturer", cat: "tech",
    surface: ["ford", "toyota", "honda", "bmw", "tesla"],
    tooclever: ["ferrari", "lamborghini", "porsche", "mercedes", "volkswagen"],
    common: ["subaru", "mazda", "volvo", "jaguar", "peugeot", "hyundai", "fiat"],
    good: ["bugatti", "koenigsegg", "lancia", "alfa romeo", "citroen", "skoda", "saab"],
    deep: ["pagani", "spyker", "hispano-suiza", "wiesmann", "morgan", "datsun", "tvr", "gumpert"] },

  { q: "Name a social media platform", cat: "tech",
    surface: ["facebook", "instagram", "twitter", "tiktok", "youtube"],
    tooclever: ["reddit", "snapchat", "linkedin", "pinterest", "discord"],
    common: ["tumblr", "twitch", "whatsapp", "telegram", "myspace", "vine", "threads"],
    good: ["mastodon", "bluesky", "weibo", "vk", "line", "wechat", "clubhouse"],
    deep: ["friendster", "orkut", "diaspora", "ello", "xanga", "hi5", "bebo", "nextdoor", "gab"] },

  // ============================ MISC FACTUAL ============================
  { q: "Name a gemstone", cat: "misc",
    surface: ["diamond", "ruby", "emerald", "sapphire", "pearl"],
    tooclever: ["opal", "amethyst", "topaz", "jade", "turquoise"],
    common: ["garnet", "aquamarine", "peridot", "onyx", "citrine", "lapis lazuli", "moonstone"],
    good: ["tanzanite", "tourmaline", "spinel", "zircon", "alexandrite", "malachite", "obsidian"],
    deep: ["benitoite", "painite", "grandidierite", "musgravite", "taaffeite", "jeremejevite", "poudretteite"] },

  { q: "Name a type of cloud", cat: "misc",
    surface: ["cumulus", "cirrus", "stratus", "storm cloud", "nimbus"],
    tooclever: ["cumulonimbus", "altocumulus", "nimbostratus"],
    common: ["stratocumulus", "altostratus", "cirrostratus", "cirrocumulus"],
    good: ["lenticular", "mammatus", "noctilucent", "contrail", "fractus", "pileus"],
    deep: ["asperitas", "kelvin-helmholtz", "arcus", "virga", "nacreous", "castellanus", "volutus"] },

  { q: "Name a chess opening", cat: "misc",
    surface: ["sicilian defense", "queen's gambit", "king's gambit", "italian game"],
    tooclever: ["ruy lopez", "french defense", "caro-kann", "english opening", "london system"],
    common: ["king's indian", "nimzo-indian", "scandinavian", "pirc", "slav defense", "scotch game"],
    good: ["grunfeld", "benoni", "alekhine's defense", "catalan", "dutch defense", "vienna game"],
    deep: ["budapest gambit", "latvian gambit", "grob's attack", "orangutan", "elephant gambit", "bongcloud", "trompowsky"] },

  { q: "Name a knot", cat: "misc",
    surface: ["bow", "square knot", "slip knot", "double knot"],
    tooclever: ["bowline", "figure eight", "clove hitch", "half hitch"],
    common: ["sheet bend", "fisherman's knot", "taut-line hitch", "reef knot", "timber hitch"],
    good: ["prusik", "alpine butterfly", "monkey's fist", "carrick bend", "sheepshank", "munter hitch"],
    deep: ["zeppelin bend", "constrictor knot", "icicle hitch", "trucker's hitch", "blake's hitch", "ashley's bend"] },

  { q: "Name a sailing or ship term", cat: "misc",
    surface: ["anchor", "mast", "deck", "sail", "bow", "stern"],
    tooclever: ["starboard", "port", "helm", "rudder", "keel", "hull"],
    common: ["galley", "bulkhead", "boom", "jib", "rigging", "aft", "bilge"],
    good: ["mizzen", "spinnaker", "gunwale", "transom", "forecastle", "windlass", "capstan"],
    deep: ["futtock", "orlop", "binnacle", "mainsheet traveller", "baggywrinkle", "scuttlebutt", "bobstay", "crosstrees"] },

  { q: "Name a fictional planet", cat: "myth",
    surface: ["tatooine", "krypton", "pandora", "vulcan", "arrakis"],
    tooclever: ["coruscant", "hoth", "endor", "naboo", "gallifrey"],
    common: ["dagobah", "mustafar", "romulus", "caprica", "magrathea", "solaris"],
    good: ["trantor", "giedi prime", "helliconia", "lusitania", "ringworld", "mongo", "perelandra"],
    deep: ["hyperion", "rakhat", "camazotz", "athshe", "jinx", "chthon", "kregen", "majipoor"] },

  { q: "Name a philosopher", cat: "hist",
    surface: ["socrates", "plato", "aristotle", "nietzsche", "descartes"],
    tooclever: ["kant", "marx", "confucius", "freud", "sartre"],
    common: ["hume", "locke", "hegel", "spinoza", "rousseau", "voltaire", "camus"],
    good: ["kierkegaard", "schopenhauer", "wittgenstein", "foucault", "heidegger", "leibniz", "aquinas"],
    deep: ["quine", "zhuangzi", "averroes", "avicenna", "plotinus", "pyrrho", "levinas", "peirce", "anaximander"] },

  { q: "Name a currency", cat: "misc",
    surface: ["dollar", "euro", "pound", "yen", "peso"],
    tooclever: ["rupee", "yuan", "franc", "won", "ruble"],
    common: ["real", "rand", "lira", "shekel", "dinar", "krona", "baht"],
    good: ["ringgit", "forint", "zloty", "dirham", "kwacha", "taka", "leu"],
    deep: ["ngultrum", "pula", "lilangeni", "ouguiya", "vatu", "dalasi", "kyat", "tugrik", "manat"] },

  { q: "Name a fabric", cat: "misc",
    surface: ["cotton", "silk", "wool", "denim", "leather"],
    tooclever: ["linen", "velvet", "satin", "polyester", "cashmere"],
    common: ["corduroy", "tweed", "chiffon", "flannel", "suede", "canvas", "lace"],
    good: ["taffeta", "organza", "jacquard", "seersucker", "gabardine", "poplin", "damask"],
    deep: ["dupioni", "grosgrain", "faille", "barathea", "batiste", "crepe de chine", "shantung", "moleskin"] },
];
