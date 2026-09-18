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
 *
 * Anything not in any list scores BEDROCK (100). That means gibberish scores
 * max — deliberately. A dictionary check would punish real-but-obscure answers,
 * which is the exact opposite of the point.
 *
 * THE CLOSED-SET RULE
 *
 * Every prompt here is a CLOSED set: one whose full membership is small
 * enough that ~30 entries genuinely covers it. 24 Greek letters, 50 state
 * capitals, 12 South American countries, 9 parts of speech.
 *
 * That is not a stylistic preference, it is what makes the scoring honest.
 * BEDROCK is supposed to mean "you found something nobody else did". On an
 * OPEN set — cheese (~1800 real answers), cocktail (~600), chess opening
 * (~1300) — a 30-entry list covers 2-5%, so almost every correct answer is
 * unlisted and BEDROCK fires constantly. It stops being a reward and becomes
 * the default. Open-set prompts were removed for exactly that reason.
 *
 * Before adding a prompt, ask: could this list plausibly contain most of the
 * real answers? If not, it belongs in norms-prompts.js (backed by measured
 * response data) or nowhere.
 */

export const PROMPTS = [
  { q: "Name a country in Africa", cat: "geo", closed: true,
    surface: ["egypt", "south africa", "kenya", "nigeria", "morocco"],
    tooclever: ["ethiopia", "ghana", "tanzania", "algeria", "uganda"],
    common: ["senegal", "zimbabwe", "sudan", "cameroon", "zambia", "tunisia", "angola"],
    good: ["burkina faso", "malawi", "benin", "gabon", "mauritania", "lesotho", "eritrea", "chad", "niger", "mali", "namibia", "botswana", "rwanda", "somalia"],
    deep: ["comoros", "sao tome", "djibouti", "guinea-bissau", "burundi", "equatorial guinea", "eswatini", "togo", "central african republic", "seychelles", "cape verde"] },

  { q: "Name a moon in our solar system", cat: "sci", closed: true,
    surface: ["the moon", "europa", "titan", "io", "ganymede"],
    tooclever: ["callisto", "phobos", "deimos", "enceladus", "triton"],
    common: ["mimas", "rhea", "dione", "iapetus", "charon", "tethys"],
    good: ["miranda", "ariel", "umbriel", "oberon", "titania", "hyperion", "nereid"],
    deep: ["amalthea", "himalia", "phoebe", "janus", "epimetheus", "proteus", "pandora", "prometheus"] },

  { q: "Name a Greek god", cat: "hist", closed: true,
    surface: ["zeus", "poseidon", "hades", "athena", "apollo"],
    tooclever: ["ares", "hermes", "artemis", "aphrodite", "hera"],
    common: ["demeter", "dionysus", "hephaestus", "hestia", "persephone", "helios"],
    good: ["nyx", "hypnos", "nemesis", "hecate", "eros", "pan", "thanatos", "iris"],
    deep: ["erebus", "tartarus", "aether", "hemera", "moros", "phanes", "eurus", "asteria"] },

  { q: "Name a US president", cat: "hist", closed: true,
    surface: ["washington", "lincoln", "kennedy", "obama", "roosevelt"],
    tooclever: ["jefferson", "reagan", "nixon", "truman", "adams"],
    common: ["madison", "jackson", "eisenhower", "wilson", "grant", "carter", "monroe"],
    good: ["polk", "garfield", "harding", "coolidge", "taft", "mckinley", "van buren",
           "bush", "clinton", "trump", "biden", "johnson", "hoover", "ford"],
    deep: ["millard fillmore", "franklin pierce", "chester arthur", "rutherford hayes", "james buchanan", "zachary taylor", "benjamin harrison", "john tyler",
           "william henry harrison", "john quincy adams", "grover cleveland"] },

  { q: "Name a position in American football", cat: "sport", closed: true,
    surface: ["quarterback", "running back", "wide receiver", "linebacker", "kicker"],
    tooclever: ["tight end", "cornerback", "safety", "punter", "center"],
    common: ["offensive tackle", "guard", "defensive end", "nose tackle", "fullback", "long snapper"],
    good: ["strong safety", "free safety", "slot receiver", "nickelback", "gunner", "h-back"],
    deep: ["dimeback", "wingback", "upback", "jack linebacker", "personal protector", "monster back"] },

  { q: "Name a Greek letter", cat: "words", closed: true,
    surface: ["alpha", "beta", "omega", "delta", "pi"],
    tooclever: ["gamma", "sigma", "theta", "lambda", "phi"],
    common: ["epsilon", "zeta", "kappa", "mu", "rho", "tau", "chi"],
    good: ["upsilon", "xi", "omicron", "eta", "nu", "psi", "iota"],
    deep: ["digamma", "koppa", "sampi", "stigma", "heta", "san"] },

  { q: "Name a Norse god", cat: "myth", closed: true,
    surface: ["thor", "odin", "loki", "freya", "hel"],
    tooclever: ["balder", "heimdall", "tyr", "frigg", "njord"],
    common: ["freyr", "sif", "bragi", "idunn", "vidar", "ullr", "skadi"],
    good: ["forseti", "vali", "hodr", "gefjon", "eir", "nanna", "aegir"],
    deep: ["kvasir", "hoenir", "lofn", "syn", "var", "fulla", "sjofn", "mimir", "gullveig"] },

  { q: "Name a Shakespeare play", cat: "culture", closed: true,
    surface: ["romeo and juliet", "hamlet", "macbeth", "julius caesar", "othello"],
    tooclever: ["king lear", "a midsummer night's dream", "the tempest", "much ado about nothing"],
    common: ["twelfth night", "the merchant of venice", "as you like it", "richard iii", "henry v", "the taming of the shrew"],
    good: ["coriolanus", "cymbeline", "titus andronicus", "measure for measure", "pericles", "timon of athens",
           "the winter's tale", "antony and cleopatra", "the comedy of errors", "two gentlemen of verona",
           "all's well that ends well", "the merry wives of windsor"],
    deep: ["troilus and cressida", "king john", "the two noble kinsmen", "love's labour's lost", "edward iii", "henry viii",
           "richard ii", "henry iv", "henry vi"] },

  { q: "Name a unit of digital storage or data", cat: "tech", closed: true,
    surface: ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"],
    tooclever: ["bit", "petabyte", "exabyte", "nibble"],
    common: ["zettabyte", "yottabyte", "kibibyte", "mebibyte", "gibibyte", "word"],
    good: ["tebibyte", "pebibyte", "exbibyte", "octet", "dword", "qword"],
    deep: ["ronnabyte", "quettabyte", "yobibyte", "zebibyte", "crumb", "hextet", "shannon", "hartley"] },

  { q: "Name a punctuation mark", cat: "words", closed: true,
    surface: ["period", "comma", "question mark", "exclamation point", "apostrophe"],
    tooclever: ["semicolon", "colon", "hyphen", "quotation mark", "dash"],
    common: ["parenthesis", "ellipsis", "bracket", "slash", "asterisk", "ampersand", "brace"],
    good: ["en dash", "em dash", "interrobang", "pilcrow", "guillemet", "tilde", "solidus"],
    deep: ["obelus", "manicule", "hedera", "octothorpe", "diple", "asterism", "percontation point", "irony mark"] },

  { q: "Name a part of speech", cat: "words", closed: true,
    surface: ["noun", "verb", "adjective", "adverb", "pronoun"],
    tooclever: ["preposition", "conjunction", "interjection", "article"],
    common: ["determiner", "auxiliary verb", "participle", "gerund", "infinitive"],
    good: ["copula", "quantifier", "expletive", "predeterminer", "modal verb", "clitic"],
    deep: ["adposition", "postposition", "classifier", "evidential", "converb", "ideophone", "circumposition"] },

  { q: "Name a landlocked country", cat: "geo", closed: true,
    /* Alternate names resolve to the canonical answer and score exactly what it
     * scores. Sourced from Wikidata skos:altLabel, filtered — see
     * wikidata-pipeline.md for why the raw dump needs filtering (it includes
     * ISO codes like "by" and "dk" that collide with real short answers). */
    aliases: { "czechia": "czech republic", "fyrom": "north macedonia",
               "macedonia": "north macedonia", "swaziland": "eswatini",
               "swiss confederation": "switzerland", "helvetia": "switzerland",
               "belorussia": "belarus", "white russia": "belarus",
               "kirghizia": "kyrgyzstan", "holy see": "vatican city",
               "vatican": "vatican city" },
    surface: ["switzerland", "austria", "mongolia", "nepal", "bolivia"],
    tooclever: ["afghanistan", "hungary", "paraguay", "kazakhstan", "czech republic"],
    common: ["laos", "zambia", "zimbabwe", "belarus", "serbia", "slovakia", "uganda"],
    good: ["bhutan", "chad", "mali", "niger", "rwanda", "burundi", "moldova", "armenia",
           "botswana", "uzbekistan", "kyrgyzstan", "azerbaijan", "north macedonia", "malawi"],
    deep: ["liechtenstein", "san marino", "andorra", "lesotho", "eswatini", "turkmenistan", "tajikistan", "south sudan",
           "burkina faso", "central african republic", "vatican city", "kosovo"] },

  { q: "Name a US state capital", cat: "geo", closed: true,
    surface: ["sacramento", "austin", "denver", "boston", "atlanta"],
    tooclever: ["albany", "springfield", "columbus", "nashville", "phoenix"],
    common: ["salem", "olympia", "madison", "raleigh", "richmond", "lansing", "des moines"],
    good: ["pierre", "bismarck", "helena", "montpelier", "augusta", "topeka", "cheyenne",
           "boise", "lincoln", "honolulu", "hartford", "trenton", "indianapolis", "oklahoma city",
           "little rock", "baton rouge", "salt lake city", "santa fe"],
    deep: ["juneau", "frankfort", "annapolis", "dover", "jefferson city", "tallahassee", "carson city", "harrisburg",
           "concord", "providence", "charleston", "jackson", "montgomery", "st paul", "columbia"] },

  { q: "Name a country in South America", cat: "geo", closed: true,
    surface: ["brazil", "argentina", "chile", "peru", "colombia"],
    tooclever: ["venezuela", "ecuador", "bolivia", "uruguay", "paraguay"],
    common: ["guyana", "suriname"],
    good: ["french guiana"],
    deep: ["falkland islands", "south georgia"] },

  { q: "Name a major organ", cat: "health", closed: true,
    surface: ["heart", "brain", "lungs", "liver", "kidney"],
    tooclever: ["stomach", "skin", "pancreas", "intestine", "bladder"],
    common: ["spleen", "gallbladder", "thyroid", "esophagus", "colon", "appendix", "uterus"],
    good: ["adrenal gland", "pituitary", "thymus", "prostate", "hypothalamus", "parathyroid"],
    deep: ["pineal gland", "duodenum", "jejunum", "ileum", "cecum", "epididymis", "lacrimal gland", "islets of langerhans"] },

  /* ==================== BATCH 2 ==================== */


  /* ---------------------------------------------------- language, sideways */

  { q: "Name another English word for a nose (any creature's counts)", cat: "words", closed: true,
    surface: ["snout", "beak", "muzzle", "schnoz", "honker"],
    tooclever: ["bill", "trunk", "proboscis", "conk", "snoot"],
    common: ["nostril", "nares", "hooter", "sniffer", "beezer", "neb"],
    good: ["rostrum", "snitch", "boko", "bugle", "smeller", "rhinarium", "septum"],
    deep: ["nasus", "olfactory organ", "probe", "snotbox", "nozzle", "beak-nose", "naris", "pecker"] },

  { q: "Name a word for a baby animal", cat: "words", closed: true,
    surface: ["puppy", "kitten", "cub", "calf", "chick"],
    tooclever: ["foal", "lamb", "piglet", "duckling", "fawn"],
    common: ["kid", "joey", "colt", "filly", "gosling", "cygnet", "owlet"],
    good: ["kit", "pup", "eyas", "leveret", "elver", "fry", "squab", "poult"],
    deep: ["spat", "smolt", "nymph", "whelp", "shoat", "codling", "parr", "grilse", "cria"] },

  { q: "Name a collective noun for a group of animals (like 'murder' for crows)", cat: "words", closed: false, gate: "wordlike",
    surface: ["pack", "herd", "flock", "school", "swarm"],
    tooclever: ["murder", "pride", "pod", "colony", "gaggle"],
    common: ["litter", "hive", "nest", "troop", "shoal", "brood", "drove"],
    good: ["parliament", "murmuration", "unkindness", "skulk", "sleuth", "bask", "cete", "clowder"],
    deep: ["wake", "kettle", "rookery", "obstinacy", "tower", "bloat", "crash", "zeal", "ambush"] },

  { q: "Name a palindrome that's a real English dictionary word", cat: "words", closed: false, gate: "wordlike",
    surface: ["mom", "dad", "eye", "level", "racecar"],
    tooclever: ["noon", "radar", "kayak", "civic", "madam"],
    common: ["pop", "wow", "did", "sees", "deed", "peep", "refer"],
    good: ["rotor", "tenet", "solos", "stats", "redder", "repaper", "rotator"],
    deep: ["deified", "reviver", "rotavator", "detartrated", "malayalam", "semes", "sagas", "minim"] },

  { q: "Name a word for a huge number (million or bigger)", cat: "words", closed: true,
    surface: ["million", "billion", "trillion", "zillion", "gazillion"],
    tooclever: ["quadrillion", "quintillion", "googol", "bazillion", "infinity"],
    common: ["sextillion", "septillion", "octillion", "nonillion", "decillion", "myriad"],
    good: ["googolplex", "undecillion", "duodecillion", "vigintillion", "centillion", "milliard", "crore", "lakh"],
    deep: ["tredecillion", "quattuordecillion", "novemdecillion", "graham's number", "skewes number", "tree(3)", "megistron", "moser's number"] },

  /* --------------------------------------------------- everyday, sideways */

  { q: "Name a type of building used for prayer", cat: "culture", closed: true,
    surface: ["church", "mosque", "temple", "synagogue", "cathedral"],
    tooclever: ["chapel", "shrine", "monastery", "basilica", "abbey"],
    common: ["gurdwara", "pagoda", "sanctuary", "minster", "convent", "oratory", "meetinghouse"],
    good: ["stupa", "ziggurat", "mandir", "vihara", "priory", "friary", "tabernacle", "kirk"],
    deep: ["fire temple", "agiary", "musalla", "wat", "duomo", "chantry", "hypogeum", "marae", "jinja"] },

  { q: "Name an occupation that involves working with children (the job itself must focus on kids)", cat: "culture", closed: false, gate: "lenient",
    surface: ["teacher", "babysitter", "nanny", "pediatrician", "daycare worker"],
    tooclever: ["coach", "principal", "school nurse", "tutor", "camp counselor"],
    common: ["midwife", "child psychologist", "au pair", "preschool teacher", "crossing guard", "lunch lady", "scout leader"],
    good: ["pediatric nurse", "speech therapist", "child life specialist", "neonatologist", "social worker", "truant officer", "guidance counselor", "doula"],
    deep: ["face painter", "puppeteer", "toy tester", "children's librarian", "orthodontist", "pediatric dentist", "milk monitor", "birthing coach", "play therapist"] },

  { q: "Name a household chore", cat: "culture", closed: true,
    /* Closed, so the phrasings players actually type must be listed — "washing
     * dishes", "doing the dishes" and "dishes" are one chore, and a player who
     * types any of them has answered correctly. */
    surface: ["dishes", "washing dishes", "doing the dishes", "washing up",
              "laundry", "doing laundry", "washing clothes",
              "vacuuming", "vacuum", "hoovering", "dusting", "mopping", "mopping the floor"],
    tooclever: ["taking out the trash", "taking out the bins", "trash", "rubbish",
                "making the bed", "sweeping", "ironing", "mowing the lawn", "mowing",
                "cooking", "cleaning", "tidying up", "washing the car"],
    common: ["folding clothes", "folding laundry", "cleaning the bathroom",
             "scrubbing the toilet", "cleaning the toilet", "raking leaves",
             "watering plants", "grocery shopping", "changing sheets",
             "changing the bed", "washing windows", "cleaning windows",
             "loading the dishwasher", "emptying the dishwasher", "weeding"],
    good: ["descaling the kettle", "cleaning the gutters", "defrosting the freezer", "scrubbing grout", "polishing silver", "shoveling snow", "changing air filters", "bleeding radiators"],
    deep: ["flipping the mattress", "cleaning the lint trap", "oiling hinges", "chimney sweeping", "resealing the tub", "cleaning the dryer vent", "beating rugs", "descaling the showerhead"] },

  { q: "Name something you drink out of", cat: "culture", closed: true,
    surface: ["glass", "cup", "mug", "bottle", "can"],
    tooclever: ["straw", "flask", "thermos", "jug", "wine glass"],
    common: ["tumbler", "goblet", "pitcher", "canteen", "stein", "carafe", "chalice"],
    good: ["tankard", "snifter", "demitasse", "coupe", "gourd", "horn", "beaker", "bowl"],
    deep: ["quaich", "porron", "bota bag", "kylix", "rhyton", "yerba mate gourd", "wineskin", "noggin", "firkin"] },

  { q: "Name a type of home or dwelling", cat: "culture", closed: true,
    surface: ["house", "apartment", "condo", "cabin", "cottage"],
    tooclever: ["mansion", "bungalow", "townhouse", "duplex", "trailer"],
    common: ["villa", "loft", "studio", "farmhouse", "penthouse", "hut", "ranch",
             "teepee", "tepee", "tipi", "castle", "flat", "dorm", "motorhome"],
    good: ["chalet", "yurt", "igloo", "houseboat", "brownstone", "tenement", "manor", "lodge",
           "barracks", "bunker", "caravan", "shack", "lean-to", "treehouse"],
    deep: ["longhouse", "wigwam", "dugout", "pueblo", "riad", "hogan", "stilt house", "troglodyte dwelling", "barndominium",
           "kraal", "trullo", "palafito", "rondavel", "minka", "dacha", "isba", "earthship", "quonset hut"] },

  { q: "Name a tool you would find in a toolbox", cat: "culture", closed: true,
    surface: ["hammer", "screwdriver", "wrench", "pliers", "tape measure"],
    tooclever: ["saw", "level", "drill", "chisel", "utility knife"],
    common: ["allen key", "socket wrench", "clamp", "file", "mallet", "crowbar", "hacksaw"],
    good: ["awl", "rasp", "plumb bob", "caliper", "vise grip", "torque wrench", "tin snips", "nail set"],
    deep: ["spokeshave", "scribe", "bradawl", "countersink", "deburring tool", "pipe reamer", "strap wrench", "center punch", "drawknife"] },

  /* ------------------------------------------------------ nature, sideways */

  { q: "Name an animal that produces its own light", cat: "sci", closed: true,
    surface: ["firefly", "anglerfish", "jellyfish", "glowworm", "lightning bug"],
    tooclever: ["squid", "plankton", "lanternfish", "krill", "sea pen"],
    common: ["dinoflagellate", "comb jelly", "viperfish", "dragonfish", "hatchetfish", "brittle star", "railroad worm"],
    good: ["vampire squid", "cookiecutter shark", "flashlight fish", "click beetle", "ostracod", "siphonophore", "pyrosome", "bobtail squid"],
    deep: ["atolla jellyfish", "tomopteris", "fire millipede", "quantula striata", "bermuda fireworm", "lanternshark", "sea sapphire", "green bomber worm"] },

  { q: "Name a mammal that lives underground", cat: "sci", closed: true,
    surface: ["mole", "gopher", "badger", "rabbit", "groundhog"],
    tooclever: ["prairie dog", "meerkat", "chipmunk", "marmot", "vole"],
    common: ["ferret", "armadillo", "wombat", "aardvark", "hedgehog", "shrew", "pocket gopher"],
    good: ["naked mole rat", "pangolin", "jerboa", "bandicoot", "echidna", "solenodon", "tuco-tuco", "zokor"],
    deep: ["blind mole rat", "golden mole", "marsupial mole", "bilby", "springhare", "mole-vole", "bamboo rat", "desman", "cape dune mole rat"] },

  { q: "Name an animal that hibernates", cat: "sci", closed: true,
    surface: ["bear", "groundhog", "bat", "hedgehog", "squirrel"],
    tooclever: ["chipmunk", "snake", "frog", "turtle", "marmot"],
    common: ["dormouse", "skunk", "badger", "snail", "bumblebee queen", "lemur", "prairie dog"],
    good: ["fat-tailed dwarf lemur", "common poorwill", "wood frog", "box turtle", "jumping mouse", "ground squirrel", "hamster", "echidna"],
    deep: ["alpine marmot", "arctic ground squirrel", "little brown myotis", "pygmy possum", "tenrec", "mouse lemur", "garden dormouse", "edible dormouse"] },

  { q: "Name an animal known for camouflage", cat: "sci", closed: true,
    surface: ["chameleon", "octopus", "stick insect", "polar bear", "leopard"],
    tooclever: ["cuttlefish", "arctic fox", "walking stick", "owl", "flounder"],
    common: ["seahorse", "praying mantis", "moth", "gecko", "snowshoe hare", "stonefish", "katydid"],
    good: ["leafy sea dragon", "ptarmigan", "mimic octopus", "orchid mantis", "decorator crab", "potoo", "tawny frogmouth", "pygmy seahorse"],
    deep: ["satanic leaf-tailed gecko", "dead leaf butterfly", "wrap-around spider", "trumpetfish", "bark mantis", "moss mimic stick insect", "flower crab spider", "glasswing butterfly"] },

  { q: "Name a creature you might find in a tide pool", cat: "sci", closed: true,
    surface: ["starfish", "crab", "sea anemone", "mussel", "snail"],
    tooclever: ["hermit crab", "barnacle", "sea urchin", "limpet", "shrimp"],
    common: ["sea cucumber", "chiton", "periwinkle", "blenny", "sculpin", "isopod", "brittle star"],
    good: ["nudibranch", "sea slug", "tube worm", "sand dollar", "amphipod", "sea hare", "porcelain crab", "clingfish"],
    deep: ["sea squirt", "bryozoan", "acorn barnacle", "ochre sea star", "sunflower star", "gumboot chiton", "tidepool sculpin", "opossum shrimp"] },

  { q: "Name a living bird that cannot fly", cat: "sci", closed: true,
    surface: ["penguin", "ostrich", "emu", "kiwi", "chicken"],
    tooclever: ["cassowary", "rhea", "turkey", "peacock", "dodo"],
    common: ["kakapo", "takahe", "weka", "steamer duck", "penguin chick", "guinea fowl", "tinamou"],
    good: ["flightless cormorant", "kagu", "inaccessible island rail", "greater rhea", "little spotted kiwi", "campbell teal", "auckland teal"],
    deep: ["titicaca grebe", "junin grebe", "invisible rail", "calayan rail", "okinawa rail", "guam rail", "fuegian steamer duck", "white-throated rail"] },

  /* ------------------------------------------------- geography with a hook */

  /* EXHAUSTIVE CATEGORY. India has only ~13 neighbours counting maritime
   * boundaries, so the tiers are the real roster split by how many people
   * reach each one — not padded. The deep tier is the maritime-only set,
   * which is exactly the "thinking beats recall" pocket: the land borders
   * are memorised, the sea borders have to be reasoned out. */
  { q: "Name a country that borders India by land or sea", cat: "geo", closed: true,
    surface: ["pakistan", "china", "nepal", "bangladesh", "sri lanka"],
    tooclever: ["bhutan", "myanmar", "afghanistan", "burma"],
    common: ["maldives"],
    good: ["indonesia", "thailand"],
    deep: ["oman"] },

  { q: "Name a country whose national flag has exactly two colors", cat: "geo", closed: true,
    surface: ["japan", "poland", "ukraine", "canada", "indonesia"],
    tooclever: ["monaco", "denmark", "switzerland", "turkey", "vietnam"],
    common: ["austria", "finland", "greece", "somalia", "morocco", "nigeria", "peru"],
    good: ["latvia", "bahrain", "qatar", "tunisia", "algeria", "singapore", "malta", "san marino"],
    deep: ["northern cyprus", "greenland", "isle of man", "alderney", "sark", "pitcairn", "bosnia"] },

  /* EXHAUSTIVE CATEGORY — there are only ~11 of these. The five-letter names
   * that feel four-letter (chile, india, china) are the trap, so they sit in
   * `reject`: typing them should score nothing, not clay. */
  { q: "Name a country with a four-letter English name", cat: "geo", closed: true,
    surface: ["iran", "iraq", "cuba", "chad", "peru"],
    tooclever: ["mali", "togo", "laos", "fiji"],
    common: ["oman"],
    good: ["niue", "guam"],
    deep: ["eire"],
    reject: ["chile", "india", "china", "italy", "spain", "japan", "kenya", "egypt"] },

  { q: "Name a strait (a narrow sea passage between two landmasses)", cat: "geo", closed: true,
    surface: ["gibraltar", "bering strait", "bosphorus", "strait of hormuz", "english channel"],
    tooclever: ["strait of malacca", "dover", "magellan", "dardanelles", "taiwan strait"],
    common: ["cook strait", "torres strait", "davis strait", "denmark strait", "bass strait", "sunda strait", "korea strait"],
    good: ["kerch strait", "skagerrak", "kattegat", "bab-el-mandeb", "drake passage", "palk strait", "makassar strait", "luzon strait"],
    deep: ["fram strait", "nares strait", "lombok strait", "mozambique channel", "kara strait", "vilkitsky strait", "matochkin strait", "juan de fuca", "otranto"] },

  { q: "Name a country that no longer exists", cat: "geo", closed: true,
    surface: ["soviet union", "yugoslavia", "czechoslovakia", "east germany", "prussia"],
    tooclever: ["ottoman empire", "roman empire", "rhodesia", "persia", "siam",
                "aztec empire", "aztec", "inca empire", "inca", "byzantine empire", "byzantium"],
    common: ["west germany", "burma", "zaire", "ceylon", "austria-hungary", "north yemen", "south vietnam"],
    good: ["tibet", "sikkim", "biafra", "tanganyika", "zanzibar", "abyssinia", "serbia and montenegro", "united arab republic"],
    deep: ["gran colombia", "republic of texas", "dahomey", "upper volta", "basutoland", "bechuanaland", "newfoundland", "hejaz", "transjordan", "ryukyu kingdom"] },

  /* -------------------------------------------------- science with a hook */

  /* EXHAUSTIVE CATEGORY — exactly 11 elements are gases at 25°C. Carbon
   * dioxide and ozone are the classic wrong answers (compounds, not
   * elements), so they are rejected rather than scored. */
  { q: "Name a chemical element that is a gas at room temperature", cat: "sci", closed: true,
    surface: ["oxygen", "hydrogen", "nitrogen", "helium", "chlorine"],
    tooclever: ["neon", "argon", "fluorine"],
    common: ["krypton"],
    good: ["xenon"],
    deep: ["radon"],
    reject: ["carbon dioxide", "ozone", "methane", "water vapor", "steam", "air", "carbon monoxide"] },

  { q: "Name a gas found in Earth's atmosphere", cat: "sci", closed: true,
    surface: ["oxygen", "nitrogen", "carbon dioxide", "hydrogen", "helium"],
    tooclever: ["argon", "methane", "ozone", "water vapor", "neon"],
    common: ["krypton", "xenon", "nitrous oxide", "carbon monoxide", "sulfur dioxide", "hydrogen sulfide", "ammonia"],
    good: ["nitrogen dioxide", "radon", "chlorofluorocarbon", "sulfur hexafluoride", "formaldehyde", "iodine vapor", "hydrogen peroxide"],
    deep: ["carbonyl sulfide", "dimethyl sulfide", "isoprene", "peroxyacetyl nitrate", "nitric oxide", "molecular chlorine", "hydroxyl radical", "tropospheric ozone"] },

  { q: "Name a part of the human brain", cat: "health", closed: true,
    surface: ["cerebrum", "cerebellum", "brain stem", "frontal lobe", "cortex"],
    tooclever: ["hippocampus", "amygdala", "thalamus", "hypothalamus", "pituitary"],
    common: ["medulla", "pons", "corpus callosum", "occipital lobe", "parietal lobe", "temporal lobe", "midbrain"],
    good: ["basal ganglia", "pineal gland", "substantia nigra", "putamen", "caudate nucleus", "insula", "fornix", "cingulate gyrus"],
    deep: ["locus coeruleus", "arcuate nucleus", "claustrum", "habenula", "area postrema", "nucleus accumbens", "subthalamic nucleus", "dentate gyrus", "globus pallidus"] },

  { q: "Name a part of the human eye", cat: "health", closed: true,
    surface: ["pupil", "iris", "retina", "cornea", "lens"],
    tooclever: ["eyelid", "eyelash", "optic nerve", "sclera", "eyebrow"],
    common: ["conjunctiva", "vitreous humor", "aqueous humor", "macula", "fovea", "choroid", "tear duct"],
    good: ["ciliary body", "zonule", "limbus", "canthus", "lacrimal gland", "trabecular meshwork", "optic disc", "caruncle"],
    deep: ["bruch's membrane", "descemet's membrane", "bowman's layer", "schlemm's canal", "ora serrata", "tapetum", "pigment epithelium", "meibomian gland"] },

  { q: "Name a human hormone", cat: "health", closed: true,
    surface: ["insulin", "testosterone", "estrogen", "adrenaline", "cortisol"],
    tooclever: ["melatonin", "dopamine", "serotonin", "oxytocin", "thyroxine"],
    common: ["progesterone", "glucagon", "growth hormone", "prolactin", "ghrelin", "leptin", "endorphin"],
    good: ["vasopressin", "aldosterone", "calcitonin", "parathyroid hormone", "somatostatin", "gastrin", "secretin", "erythropoietin"],
    deep: ["cholecystokinin", "relaxin", "inhibin", "motilin", "orexin", "irisin", "amylin", "adiponectin", "thymosin"] },

  { q: "Name a subatomic particle", cat: "sci", closed: true,
    surface: ["electron", "proton", "neutron", "photon", "quark"],
    tooclever: ["neutrino", "positron", "boson", "muon", "higgs boson"],
    common: ["gluon", "lepton", "tau", "pion", "hadron", "meson", "fermion"],
    good: ["antiquark", "antineutrino", "kaon", "w boson", "z boson", "graviton", "baryon", "antiproton"],
    deep: ["strange quark", "charm quark", "bottom quark", "top quark", "lambda baryon", "sigma baryon", "eta meson", "axion", "sterile neutrino"] },

  { q: "Name a state of matter", cat: "sci", closed: true,
    surface: ["solid", "liquid", "gas", "plasma", "ice"],
    tooclever: ["bose-einstein condensate", "vapor", "steam", "crystal", "supercritical fluid"],
    common: ["superfluid", "supersolid", "liquid crystal", "colloid", "amorphous solid", "glass"],
    good: ["fermionic condensate", "degenerate matter", "quark-gluon plasma", "neutron-degenerate matter", "photonic matter", "rydberg matter"],
    deep: ["time crystal", "excitonium", "strange matter", "dropleton", "supercritical plasma", "quantum spin liquid", "color-glass condensate"] },

  /* -------------------------------------------------- culture with a hook */

  { q: "Name a Pixar protagonist (co-leads count)", cat: "culture", closed: true,
    surface: ["woody", "buzz lightyear", "nemo", "lightning mcqueen", "wall-e"],
    tooclever: ["marlin", "dory", "mike wazowski", "sulley", "remy"],
    common: ["mr incredible", "merida", "joy", "riley", "miguel", "carl fredricksen", "russell"],
    good: ["flik", "eve", "linguini", "arlo", "coco", "luca", "mei lee", "ember lumen"],
    deep: ["dug", "hector", "wade ripple", "alberto", "barley lightfoot", "ian lightfoot", "anxiety", "greg the raccoon", "bing bong"] },

  { q: "Name a literary device", cat: "words", closed: true,
    surface: ["metaphor", "simile", "alliteration", "personification", "hyperbole"],
    tooclever: ["irony", "foreshadowing", "onomatopoeia", "symbolism", "oxymoron"],
    common: ["allegory", "imagery", "juxtaposition", "allusion", "paradox", "euphemism", "motif"],
    good: ["anaphora", "chiasmus", "synecdoche", "metonymy", "litotes", "zeugma", "asyndeton", "polysyndeton"],
    deep: ["anadiplosis", "epistrophe", "hypallage", "aposiopesis", "syllepsis", "antanaclasis", "prolepsis", "enallage", "hendiadys"] },

  { q: "Name a logical fallacy", cat: "words", closed: false, gate: "wordlike",
    surface: ["straw man", "ad hominem", "slippery slope", "red herring", "false dilemma"],
    tooclever: ["circular reasoning", "appeal to authority", "bandwagon", "begging the question", "whataboutism"],
    common: ["appeal to emotion", "hasty generalization", "false equivalence", "post hoc", "no true scotsman", "sunk cost", "moving the goalposts"],
    good: ["tu quoque", "genetic fallacy", "equivocation", "composition fallacy", "division fallacy", "gambler's fallacy", "texas sharpshooter", "special pleading"],
    deep: ["affirming the consequent", "denying the antecedent", "masked man fallacy", "fallacy of the beard", "argumentum ad populum", "nirvana fallacy", "kettle logic", "quoting out of context", "ecological fallacy"] },

  { q: "Name a type of graph or chart", cat: "sci", closed: true,
    surface: ["bar chart", "pie chart", "line graph", "scatter plot", "histogram"],
    tooclever: ["venn diagram", "flowchart", "bubble chart", "area chart", "pictograph"],
    common: ["box plot", "heat map", "gantt chart", "radar chart", "tree map", "waterfall chart", "donut chart"],
    good: ["sankey diagram", "violin plot", "candlestick chart", "funnel chart", "chord diagram", "sunburst chart", "parallel coordinates", "dendrogram"],
    deep: ["marimekko chart", "bullet graph", "ternary plot", "hexbin plot", "ridgeline plot", "beeswarm plot", "alluvial diagram", "voronoi diagram", "q-q plot"] },

  { q: "Name a math symbol", cat: "sci", closed: true,
    surface: ["plus", "minus", "equals", "divide", "multiply"],
    tooclever: ["pi", "infinity", "square root", "percent", "greater than"],
    common: ["sigma", "delta", "theta", "integral", "factorial", "not equal", "less than"],
    good: ["nabla", "partial derivative", "therefore", "element of", "union", "intersection", "subset", "for all"],
    deep: ["aleph", "tensor product", "circled plus", "there exists", "proportional to", "congruent", "asymptotically equal", "contour integral", "turnstile"] },

  /* EXHAUSTIVE CATEGORY — all 24 official SI prefixes, tiered by how far
   * from everyday use each one sits. The 2022 additions (ronna/quetta/
   * ronto/quecto) are the genuine fossil bed. */
  { q: "Name a metric (SI) prefix", cat: "sci", closed: true,
    surface: ["kilo", "centi", "milli", "mega", "giga"],
    tooclever: ["micro", "nano", "tera", "deci", "hecto"],
    common: ["pico", "deca", "peta", "exa"],
    good: ["femto", "atto", "zetta", "yotta"],
    deep: ["zepto", "yocto", "ronna", "quetta", "ronto", "quecto"] },

  { q: "Name a type of energy", cat: "sci", closed: true,
    surface: ["solar", "kinetic", "potential", "thermal", "nuclear"],
    tooclever: ["wind", "chemical", "electrical", "mechanical", "hydroelectric"],
    common: ["geothermal", "sound", "light", "elastic", "magnetic", "tidal", "biomass"],
    good: ["gravitational", "radiant", "ionization", "binding energy", "zero-point", "rest energy", "internal energy"],
    deep: ["dark energy", "vacuum energy", "enthalpy", "gibbs free energy", "helmholtz free energy", "exergy", "lattice energy", "fermi energy"] },

  { q: "Name a branch of science ending in -ology", cat: "sci", closed: false, gate: "wordlike",
    surface: ["biology", "geology", "psychology", "zoology", "archaeology"],
    tooclever: ["meteorology", "cardiology", "neurology", "sociology", "anthropology"],
    common: ["microbiology", "pathology", "radiology", "ecology", "immunology", "seismology", "virology"],
    good: ["herpetology", "ichthyology", "entomology", "ornithology", "paleontology", "epidemiology", "endocrinology", "mycology"],
    deep: ["malacology", "arachnology", "oology", "conchology", "speleology", "vexillology", "campanology", "gerontology", "trichology", "carcinology"] },

  { q: "Name a phobia (its formal name, like 'arachnophobia')", cat: "words", closed: false, gate: "wordlike",
    surface: ["arachnophobia", "claustrophobia", "acrophobia", "agoraphobia", "hydrophobia"],
    tooclever: ["xenophobia", "homophobia", "necrophobia", "ophidiophobia", "trypophobia"],
    common: ["aerophobia", "nyctophobia", "thanatophobia", "glossophobia", "mysophobia", "zoophobia", "pyrophobia"],
    good: ["emetophobia", "trypanophobia", "cynophobia", "astraphobia", "coulrophobia", "megalophobia", "thalassophobia", "entomophobia"],
    deep: ["hippopotomonstrosesquippedaliophobia", "arithmophobia", "chionophobia", "ablutophobia", "pogonophobia", "nomophobia", "phasmophobia", "sesquipedalophobia", "alektorophobia"] },

  { q: "Name a type of knot", cat: "culture", closed: false, gate: "wordlike",
    surface: ["bow", "square knot", "slip knot", "granny knot", "overhand knot"],
    tooclever: ["bowline", "figure eight", "clove hitch", "half hitch", "reef knot"],
    common: ["sheet bend", "taut-line hitch", "timber hitch", "fisherman's knot", "sheepshank", "cleat hitch", "prusik"],
    good: ["alpine butterfly", "münter hitch", "trucker's hitch", "constrictor knot", "rolling hitch", "double fisherman's", "carrick bend", "monkey's fist"],
    deep: ["zeppelin bend", "ashley's stopper", "farrimond friction hitch", "icicle hitch", "blake's hitch", "klemheist", "buntline hitch", "highwayman's hitch", "turk's head"] },

  { q: "Name a street suffix (like Street or Avenue)", cat: "culture", closed: true,
    /* Abbreviations are listed as aliases in the SAME tier as the word they
     * stand for. On real signage and mail a street suffix usually IS the
     * abbreviation, and the prompt's own example ("like Street or Avenue")
     * invites them — "rd" scoring NOTHING while "road" scores TOPSOIL is the
     * game contradicting itself. They are not separate answers, so they never
     * sit in a deeper tier than their full form. */
    surface: ["street", "st", "avenue", "ave", "road", "rd", "drive", "dr", "lane", "ln"],
    tooclever: ["boulevard", "blvd", "court", "ct", "place", "pl", "way", "circle", "cir"],
    common: ["terrace", "ter", "parkway", "pkwy", "highway", "hwy", "trail", "trl",
             "crescent", "cres", "plaza", "plz", "alley",
             "expressway", "express", "freeway", "route", "pike", "loop", "bend", "run"],
    good: ["esplanade", "mews", "close", "quay", "causeway", "row", "byway", "turnpike", "tpke"],
    deep: ["wynd", "vennel", "ginnel", "twitten", "snicket", "chase", "garth", "rise", "spur", "dene"] },

  { q: "Name a geologic eon, era, period, or epoch", cat: "sci", closed: true,
    surface: ["jurassic", "cretaceous", "triassic", "ice age", "mesozoic"],
    tooclever: ["paleozoic", "cenozoic", "precambrian", "cambrian", "pleistocene"],
    common: ["holocene", "devonian", "permian", "silurian", "ordovician", "carboniferous", "miocene"],
    good: ["pliocene", "eocene", "oligocene", "paleocene", "archean", "proterozoic", "hadean", "neogene"],
    deep: ["ediacaran", "tonian", "cryogenian", "stenian", "ectasian", "calymmian", "statherian", "orosirian", "rhyacian", "siderian", "meghalayan"] },

  { q: "Name a type of paper", cat: "culture", closed: true,
    surface: ["printer paper", "construction paper", "tissue paper", "wrapping paper", "cardboard"],
    tooclever: ["parchment", "newsprint", "sandpaper", "wax paper", "graph paper"],
    common: ["cardstock", "vellum", "tracing paper", "crepe paper", "blotting paper", "carbon paper", "rice paper"],
    good: ["onionskin", "manila", "kraft paper", "bristol board", "papyrus", "glassine", "washi", "bond paper"],
    deep: ["tyvek", "japanese kozo", "laid paper", "wove paper", "cotton rag", "banana paper", "khadi paper", "abaca", "amate"] },

  { q: "Name a piece of armor", cat: "hist", closed: true,
    surface: ["helmet", "shield", "breastplate", "chainmail", "gauntlet"],
    tooclever: ["visor", "greaves", "plate armor", "helm", "bracer"],
    common: ["cuirass", "pauldron", "vambrace", "gorget", "hauberk", "coif", "sabaton"],
    good: ["cuisse", "poleyn", "besagew", "fauld", "rerebrace", "couter", "spaulder", "tasset"],
    deep: ["gardbrace", "gousset", "culet", "lamé", "bevor", "aventail", "brigandine", "jack of plate", "sallet", "burgonet"] },

  { q: "Name an ancient civilization", cat: "hist", closed: false, gate: "wordlike",
    surface: ["egyptian", "roman", "greek", "mayan", "aztec"],
    tooclever: ["inca", "mesopotamian", "babylonian", "persian", "chinese"],
    common: ["sumerian", "assyrian", "phoenician", "carthaginian", "minoan", "olmec", "hittite"],
    good: ["etruscan", "mycenaean", "nubian", "elamite", "akkadian", "harappan", "scythian", "parthian"],
    deep: ["nabatean", "urartu", "kush", "axum", "sogdian", "chavin", "moche", "tiwanaku", "dilmun", "mitanni"] },

  { q: "Name a cryptid (a creature like Bigfoot whose existence is claimed but unproven)", cat: "myth", closed: false, gate: "wordlike",
    surface: ["bigfoot", "loch ness monster", "yeti", "chupacabra", "sasquatch"],
    tooclever: ["mothman", "jersey devil", "kraken", "abominable snowman", "nessie"],
    common: ["jackalope", "thunderbird", "wendigo", "skunk ape", "bunyip", "yowie", "champ"],
    good: ["mokele-mbembe", "ogopogo", "flatwoods monster", "beast of bray road", "dover demon", "lizard man", "fouke monster", "mongolian death worm"],
    deep: ["hodag", "tatzelwurm", "ahool", "orang pendek", "ropen", "bunny man", "goatman", "sheepsquatch", "altamaha-ha", "wampus cat"] },

  { q: "Name a Roman god or goddess", cat: "myth", closed: true,
    surface: ["jupiter", "mars", "venus", "neptune", "pluto"],
    tooclever: ["mercury", "apollo", "diana", "juno", "saturn"],
    common: ["minerva", "vulcan", "ceres", "bacchus", "vesta", "cupid", "janus"],
    good: ["fortuna", "faunus", "terminus", "bellona", "aurora", "somnus", "victoria", "flora"],
    deep: ["consus", "portunus", "vertumnus", "robigus", "carmenta", "feronia", "picus", "libitina", "lares", "penates"] },
];
