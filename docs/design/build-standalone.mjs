// Genera una copia autocontenida de cada pantalla: CSS, fuentes e imágenes incrustados.
// Uso: node docs/design/build-standalone.mjs
// Las fuentes de verdad son los *.html y assets/. La carpeta standalone/ se regenera.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const design = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(design, 'standalone');
fs.mkdirSync(outDir, { recursive: true });

const dataUri = (rel, mime) => `data:${mime};base64,${fs.readFileSync(path.join(design, rel)).toString('base64')}`;

const fonts = {
  'fonts/orbitron-latin-wght-normal.woff2': dataUri('assets/fonts/orbitron-latin-wght-normal.woff2', 'font/woff2'),
  'fonts/exo-2-latin-wght-normal.woff2': dataUri('assets/fonts/exo-2-latin-wght-normal.woff2', 'font/woff2'),
};
const images = {
  'assets/images/arkanium-mark.png': dataUri('assets/images/arkanium-mark.png', 'image/png'),
  'assets/images/arkanium-logo-lockup.png': dataUri('assets/images/arkanium-logo-lockup.png', 'image/png'),
};

const downloadsDir = path.join(design, 'assets', 'downloads');
const mimeFor = name => (name.endsWith('.pdf') ? 'application/pdf' : 'text/csv');
const downloads = Object.fromEntries(
  fs.readdirSync(downloadsDir).map((name) => [`assets/downloads/${name}`, dataUri(`assets/downloads/${name}`, mimeFor(name))]),
);

function inlineCss(href) {
  let css = fs.readFileSync(path.join(design, href), 'utf8');
  for (const [rel, uri] of Object.entries(fonts)) css = css.split(`url('${rel}')`).join(`url('${uri}')`);
  return css;
}

const pages = fs.readdirSync(design).filter((f) => f.endsWith('.html'));
for (const file of pages) {
  let html = fs.readFileSync(path.join(design, file), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)" \/>/g, (_, href) => `<style>\n${inlineCss(href)}\n</style>`);
  for (const [rel, uri] of Object.entries(images)) html = html.split(`src="${rel}"`).join(`src="${uri}"`);
  // Archivos descargables: se incrustan para que cada copia funcione sola.
  for (const [rel, uri] of Object.entries(downloads)) html = html.split(rel).join(uri);
  const left = (html.match(/(href|src)="(assets|fonts)\//g) || []).length;
  if (left) throw new Error(`${file}: quedan ${left} referencias relativas`);
  fs.writeFileSync(path.join(outDir, file), html);
  console.log(file, (html.length / 1024).toFixed(0), 'KB');
}
