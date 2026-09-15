/* Stage the game into public/ for deployment.

   Only what the browser actually loads ships: index.html and the modules it
   imports. The data the prompts were built from (prevalence.tsv, the CSVs,
   battig-raw.json) is build-time only and stays out of the deploy — it is
   megabytes, and no runtime code fetches it. */
import { copyFileSync, mkdirSync, rmSync, statSync } from 'node:fs';

const FILES = [
  'index.html',
  'main.js',
  'game.js',
  'norms-prompts.js',
  'prompts.js',
];

rmSync('public', { recursive: true, force: true });
mkdirSync('public', { recursive: true });

let total = 0;
for (const f of FILES) {
  copyFileSync(f, `public/${f}`);
  const { size } = statSync(`public/${f}`);
  total += size;
  console.log(`  ${f.padEnd(18)} ${String(size).padStart(7)} bytes`);
}
console.log(`staged ${FILES.length} files, ${(total / 1024).toFixed(0)} KB -> public/`);
