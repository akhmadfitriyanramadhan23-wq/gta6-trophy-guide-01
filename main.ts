// A working gta6-trophy-guide-01 entry (Node 22, standard library only): the guide is this directory's app/ folder,
// plain static files a browser opens at app/index.html (ES modules, CSS, no build step), offline: it loads nothing
// over the network, and its trophy list and guides are app/data/trophies.json. The program hands it in: it copies app/
// and screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the judge reads (your
// screenshots, the first load's files and bytes, and your source), with the vendored make.fun library. Leave
// vendor/makefun-frontend.ts as it is: the scorer requires dossier.json to be byte for byte what its own copy writes.
//
// Leonida 55 — my rebuild of the guide for this bounty: the same plumbing
// as the starter (copy app/ and screenshots/, write dossier.json with the
// vendored make.fun library), but the app itself is new — a tracker with a
// roadmap, kind and grade filters, a spoiler setting, saved progress with
// export/import, and a cited guide in my own words for each of the 55
// trophies in app/data/trophies.json. Before it builds the dossier it
// checks its own inputs, so a missing index.html or a screenshot over the
// gate's cap fails here with a plain message instead of silently handing
// in an entry the scorer would refuse.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight check (mine): refuse to hand in an entry the gate would
// refuse — a missing index.html, or screenshots outside the gate's shape
// (3 to 4 files, each at most 256 KiB). The scorer's caps are enforced
// again by buildDossier below; this just fails earlier, with words.
if (!existsSync(join(here, 'app', 'index.html'))) {
  throw new Error('Leonida 55: app/index.html is missing, refusing to build the dossier.');
}
const shotDir = join(here, 'screenshots');
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => !f.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`Leonida 55: screenshots/ holds ${shots.length} images, the gate wants 3 or 4.`);
}
for (const shot of shots) {
  const size = statSync(join(shotDir, shot)).size;
  if (size > 262144) throw new Error(`Leonida 55: screenshots/${shot} is ${size} bytes, over the 256 KiB cap.`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files and directories in app/ or
// 48 MiB of app files: app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
