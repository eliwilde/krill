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
  { q: "Name a country in Africa", cat: "geo",
    surface: ["egypt", "south africa", "kenya", "nigeria", "morocco"],
    tooclever: ["ethiopia", "ghana", "tanzania", "algeria", "uganda"],
    common: ["senegal", "zimbabwe", "sudan", "cameroon", "zambia", "tunisia", "angola"],
    good: ["burkina faso", "malawi", "benin", "gabon", "mauritania", "lesotho", "eritrea", "chad", "niger", "mali", "namibia", "botswana", "rwanda", "somalia"],
    deep: ["comoros", "sao tome", "djibouti", "guinea-bissau", "burundi", "equatorial guinea", "eswatini", "togo", "central african republic", "seychelles", "cape verde"] },

  { q: "Name a moon in our solar system", cat: "sci",
    surface: ["the moon", "europa", "titan", "io", "ganymede"],
    tooclever: ["callisto", "phobos", "deimos", "enceladus", "triton"],
    common: ["mimas", "rhea", "dione", "iapetus", "charon", "tethys"],
    good: ["miranda", "ariel", "umbriel", "oberon", "titania", "hyperion", "nereid"],
    deep: ["amalthea", "himalia", "phoebe", "janus", "epimetheus", "proteus", "pandora", "prometheus"] },

  { q: "Name a Greek god", cat: "hist",
    surface: ["zeus", "poseidon", "hades", "athena", "apollo"],
    tooclever: ["ares", "hermes", "artemis", "aphrodite", "hera"],
    common: ["demeter", "dionysus", "hephaestus", "hestia", "persephone", "helios"],
    good: ["nyx", "hypnos", "nemesis", "hecate", "eros", "pan", "thanatos", "iris"],
    deep: ["erebus", "tartarus", "aether", "hemera", "moros", "phanes", "eurus", "asteria"] },

  { q: "Name a US president", cat: "hist",
    surface: ["washington", "lincoln", "kennedy", "obama", "roosevelt"],
    tooclever: ["jefferson", "reagan", "nixon", "truman", "adams"],
    common: ["madison", "jackson", "eisenhower", "wilson", "grant", "carter", "monroe"],
    good: ["polk", "garfield", "harding", "coolidge", "taft", "mckinley", "van buren",
           "bush", "clinton", "trump", "biden", "johnson", "hoover", "ford"],
    deep: ["millard fillmore", "franklin pierce", "chester arthur", "rutherford hayes", "james buchanan", "zachary taylor", "benjamin harrison", "john tyler",
           "william henry harrison", "john quincy adams", "grover cleveland"] },

  { q: "Name a position in American football", cat: "sport",
    surface: ["quarterback", "running back", "wide receiver", "linebacker", "kicker"],
    tooclever: ["tight end", "cornerback", "safety", "punter", "center"],
    common: ["offensive tackle", "guard", "defensive end", "nose tackle", "fullback", "long snapper"],
    good: ["strong safety", "free safety", "slot receiver", "nickelback", "gunner", "h-back"],
    deep: ["dimeback", "wingback", "upback", "jack linebacker", "personal protector", "monster back"] },

  { q: "Name a Greek letter", cat: "words",
    surface: ["alpha", "beta", "omega", "delta", "pi"],
    tooclever: ["gamma", "sigma", "theta", "lambda", "phi"],
    common: ["epsilon", "zeta", "kappa", "mu", "rho", "tau", "chi"],
    good: ["upsilon", "xi", "omicron", "eta", "nu", "psi", "iota"],
    deep: ["digamma", "koppa", "sampi", "stigma", "heta", "san"] },

  { q: "Name a Norse god", cat: "myth",
    surface: ["thor", "odin", "loki", "freya", "hel"],
    tooclever: ["balder", "heimdall", "tyr", "frigg", "njord"],
    common: ["freyr", "sif", "bragi", "idunn", "vidar", "ullr", "skadi"],
    good: ["forseti", "vali", "hodr", "gefjon", "eir", "nanna", "aegir"],
    deep: ["kvasir", "hoenir", "lofn", "syn", "var", "fulla", "sjofn", "mimir", "gullveig"] },

  { q: "Name a Shakespeare play", cat: "culture",
    surface: ["romeo and juliet", "hamlet", "macbeth", "julius caesar", "othello"],
    tooclever: ["king lear", "a midsummer night's dream", "the tempest", "much ado about nothing"],
    common: ["twelfth night", "the merchant of venice", "as you like it", "richard iii", "henry v", "the taming of the shrew"],
    good: ["coriolanus", "cymbeline", "titus andronicus", "measure for measure", "pericles", "timon of athens",
           "the winter's tale", "antony and cleopatra", "the comedy of errors", "two gentlemen of verona",
           "all's well that ends well", "the merry wives of windsor"],
    deep: ["troilus and cressida", "king john", "the two noble kinsmen", "love's labour's lost", "edward iii", "henry viii",
           "richard ii", "henry iv", "henry vi"] },

  { q: "Name a unit of digital storage or data", cat: "tech",
    surface: ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"],
    tooclever: ["bit", "petabyte", "exabyte", "nibble"],
    common: ["zettabyte", "yottabyte", "kibibyte", "mebibyte", "gibibyte", "word"],
    good: ["tebibyte", "pebibyte", "exbibyte", "octet", "dword", "qword"],
    deep: ["ronnabyte", "quettabyte", "yobibyte", "zebibyte", "crumb", "hextet", "shannon", "hartley"] },

  { q: "Name a punctuation mark", cat: "words",
    surface: ["period", "comma", "question mark", "exclamation point", "apostrophe"],
    tooclever: ["semicolon", "colon", "hyphen", "quotation mark", "dash"],
    common: ["parenthesis", "ellipsis", "bracket", "slash", "asterisk", "ampersand", "brace"],
    good: ["en dash", "em dash", "interrobang", "pilcrow", "guillemet", "tilde", "solidus"],
    deep: ["obelus", "manicule", "hedera", "octothorpe", "diple", "asterism", "percontation point", "irony mark"] },

  { q: "Name a part of speech", cat: "words",
    surface: ["noun", "verb", "adjective", "adverb", "pronoun"],
    tooclever: ["preposition", "conjunction", "interjection", "article"],
    common: ["determiner", "auxiliary verb", "participle", "gerund", "infinitive"],
    good: ["copula", "quantifier", "expletive", "predeterminer", "modal verb", "clitic"],
    deep: ["adposition", "postposition", "classifier", "evidential", "converb", "ideophone", "circumposition"] },

  { q: "Name a landlocked country", cat: "geo",
    surface: ["switzerland", "austria", "mongolia", "nepal", "bolivia"],
    tooclever: ["afghanistan", "hungary", "paraguay", "kazakhstan", "czech republic"],
    common: ["laos", "zambia", "zimbabwe", "belarus", "serbia", "slovakia", "uganda"],
    good: ["bhutan", "chad", "mali", "niger", "rwanda", "burundi", "moldova", "armenia",
           "botswana", "uzbekistan", "kyrgyzstan", "azerbaijan", "north macedonia", "malawi"],
    deep: ["liechtenstein", "san marino", "andorra", "lesotho", "eswatini", "turkmenistan", "tajikistan", "south sudan",
           "burkina faso", "central african republic", "vatican city", "kosovo"] },

  { q: "Name a US state capital", cat: "geo",
    surface: ["sacramento", "austin", "denver", "boston", "atlanta"],
    tooclever: ["albany", "springfield", "columbus", "nashville", "phoenix"],
    common: ["salem", "olympia", "madison", "raleigh", "richmond", "lansing", "des moines"],
    good: ["pierre", "bismarck", "helena", "montpelier", "augusta", "topeka", "cheyenne",
           "boise", "lincoln", "honolulu", "hartford", "trenton", "indianapolis", "oklahoma city",
           "little rock", "baton rouge", "salt lake city", "santa fe"],
    deep: ["juneau", "frankfort", "annapolis", "dover", "jefferson city", "tallahassee", "carson city", "harrisburg",
           "concord", "providence", "charleston", "jackson", "montgomery", "st paul", "columbia"] },

  { q: "Name a country in South America", cat: "geo",
    surface: ["brazil", "argentina", "chile", "peru", "colombia"],
    tooclever: ["venezuela", "ecuador", "bolivia", "uruguay", "paraguay"],
    common: ["guyana", "suriname"],
    good: ["french guiana"],
    deep: ["falkland islands", "south georgia"] },

  { q: "Name a major organ", cat: "health",
    surface: ["heart", "brain", "lungs", "liver", "kidney"],
    tooclever: ["stomach", "skin", "pancreas", "intestine", "bladder"],
    common: ["spleen", "gallbladder", "thyroid", "esophagus", "colon", "appendix", "uterus"],
    good: ["adrenal gland", "pituitary", "thymus", "prostate", "hypothalamus", "parathyroid"],
    deep: ["pineal gland", "duodenum", "jejunum", "ileum", "cecum", "epididymis", "lacrimal gland", "islets of langerhans"] },
];
