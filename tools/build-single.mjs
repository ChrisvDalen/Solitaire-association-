// Bundles the game into one self-contained HTML fragment (dist/filed-under.html):
// everything between the <!--page--> markers, with the stylesheet and scripts inlined.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const out = process.argv[2] || join(root, 'dist/filed-under.html');

const html = read('index.html');
let page = [...html.matchAll(/<!--page-->([\s\S]*?)<!--\/page-->/g)].map((m) => m[1].trim()).join('\n');
page = page
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}</style>`)
  .replace(/<script src="(src\/[\w.]+)"><\/script>/g, (_, p) => `<script>\n${read(p)}</script>`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page + '\n');
console.log('wrote', out, (page.length / 1024).toFixed(1) + ' KB');
