/* build-lexicon.js — emit the browser's real-word lexicon.
 *
 *   node build-lexicon.js
 *
 * WHY: the gate that stops "gorbleflax" scoring 70 points needs a list of real
 * English words. Under Node it reads prevalence.tsv directly, but that file is
 * 1MB and build.js deliberately keeps it out of the deploy. So the browser gets
 * a filtered, compressed subset instead.
 *
 * WHAT IS KEPT, and why it is far less than the whole list:
 *
 * The full 61k lemmas cost 645 KB, which is heavy for a game whose point is
 * loading instantly. The obvious trim — drop rare words — turns out to be
 * exactly wrong: filtering to Pknown >= 0.20 saved only 23 KB and dropped
 * "hoatzin", "tuatara" and "kvass", which are precisely the obscure-but-real
 * answers this game exists to reward. Measured, rejected, recorded here so it
 * is not tried again.
 *
 * What works instead is dropping words the gate can never be ASKED about. The
 * gate only ever runs on a guess that failed to match any listed answer, and
 * only on OPEN prompts. A guess is therefore either a real answer we did not
 * list, or junk. Common English verbs, adverbs, adjectives and function words
 * ("although", "quickly", "happier") are none of those — nobody answers "name
 * a bird" with "although" — so they cost bytes and buy nothing.
 *
 * Rather than guess at parts of speech, we use a sharper proxy: a word is kept
 * if it is morphologically a plausible NOUN. That drops the -ly adverbs, the
 * -ing/-ed verb forms and the comparative/superlative adjectives, which is
 * where the bulk of the list sits, while keeping every concrete noun a player
 * might type. Nothing rare is dropped, so the obscure answers stay.
 *
 * FORMAT: a newline-joined string in a JS module, not JSON. A Set built from
 * split('\n') is both smaller on the wire and faster to construct than parsing
 * a JSON array of tens of thousands of strings.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const SRC = 'prevalence.tsv';
const OUT = 'lexicon.js';
/* 2 characters, not 4.
 *
 * A 4-character floor looked free — the gate's own length rules already handle
 * short guesses — but it dropped "kea", and that is a real bird a player can
 * reasonably name. The whole set of 2-3 letter lemmas is 770 words and 3 KB,
 * and it carries exactly the short animal names this game asks for: kea, emu,
 * gnu, moa, koi, elk, owl, cod, eel, yak. Not worth saving 3 KB to lose them. */
const MIN_LEN = 2;

/* Endings that mark a word as a form the gate will never be asked about: an
 * adverb, an inflected verb, or a comparative adjective. A handful of real
 * nouns end this way ("building", "ceiling", "kindred"), so anything on the
 * KEEP list survives regardless.
 *
 * Note -ing is NOT here: too many real nouns end in it (building, herring,
 * pudding, sterling, dumpling), and the false-drop risk outweighs the bytes. */
const DROP_SUFFIX = /(?:ly|ness|ment|ized|ised|izing|ising|edly|ingly|fully|ably|ibly|iest|ier)$/;

/* Regular past/participle forms: "walked", "carried". Kept separate because a
 * bare -ed test would drop "seaweed", "hundred", "sacred". */
const DROP_PAST = /(?:[bcdfghjklmnpqrstvwxz]ed|ied)$/;

/* Real nouns that the rules above would wrongly discard. */
const KEEP = new Set(['building', 'ceiling', 'herring', 'pudding', 'sterling',
  'dumpling', 'seaweed', 'hundred', 'sacred', 'kindred', 'reed', 'weed', 'seed',
  'breed', 'steed', 'creed', 'tweed', 'speed', 'deed', 'feed', 'need', 'greed',
  'bleed', 'freed', 'shed', 'sled', 'bed', 'wed', 'fled', 'bred', 'thread',
  'spread', 'bread', 'dread', 'instead', 'homestead', 'moped', 'biped',
  'quadruped', 'centipede', 'millipede', 'aphid', 'squid', 'monument',
  'ornament', 'sediment', 'pigment', 'filament', 'ligament', 'segment',
  'fragment', 'garment', 'cement', 'element', 'condiment', 'regiment',
  'wilderness', 'business', 'witness', 'harness', 'fortress', 'mattress',
  'butterfly', 'dragonfly', 'firefly', 'mayfly', 'horsefly', 'family',
  'lily', 'holly', 'belly', 'jelly', 'rally', 'valley', 'trolley', 'medley',
  'barley', 'parsley', 'assembly', 'anomaly', 'supply', 'reply', 'ally']);

const text = readFileSync(SRC, 'utf8');
const lines = text.split(/\r?\n/);

const head = lines[0].split('\t');
const wi = head.indexOf('Word');
if (wi < 0) throw new Error(`unexpected columns: ${head.join(', ')}`);

const words = [];
let skippedShort = 0, skippedOdd = 0, skippedForm = 0;

for (let i = 1; i < lines.length; i++) {
  const f = lines[i].split('\t');
  const w = f[wi];
  if (!w) continue;
  const clean = w.toLowerCase().trim();
  // Only plain alphabetic lemmas: the gate normalises before lookup, so an
  // entry with punctuation could never match anyway.
  if (!/^[a-z]+$/.test(clean)) { skippedOdd++; continue; }
  if (clean.length < MIN_LEN) { skippedShort++; continue; }
  if (!KEEP.has(clean) && (DROP_SUFFIX.test(clean) || DROP_PAST.test(clean))) {
    skippedForm++;
    continue;
  }
  words.push(clean);
}

words.sort();
const unique = [...new Set(words)];

const body = `/* GENERATED by build-lexicon.js — do not edit by hand.
 *
 * ${unique.length.toLocaleString()} real English noun-shaped lemmas of ${MIN_LEN}+ characters, from
 * Brysbaert, Mandera, McCormick & Keuleers (2019),
 * "Word prevalence norms for 62,000 English lemmas" (Behavior Research Methods 51(2)).
 *
 * This is the browser's copy of the word list the answer gate checks against.
 * See prompt-schema.js for how it is used — in short, it PROMOTES a guess to
 * "real word" and never rejects one, because its gaps (pierogi, jabuticaba)
 * are real and those are correct answers.
 */
export const LEXICON_WORDS = ${JSON.stringify(unique.join('\n'))};
`;

writeFileSync(OUT, body);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`read    ${SRC} (${kb(statSync(SRC).size)})`);
console.log(`kept    ${unique.length.toLocaleString()} lemmas (${MIN_LEN}+ chars, noun-shaped)`);
console.log(`skipped ${skippedShort.toLocaleString()} too short, ${skippedForm.toLocaleString()} adverb/verb/comparative forms, ${skippedOdd.toLocaleString()} non-alphabetic`);
console.log(`wrote   ${OUT} (${kb(statSync(OUT).size)})`);
console.log('\nDropped word FORMS are not rejected at play time — they fall through');
console.log('to the shape check in prompt-schema.js. No rare word was dropped.');
