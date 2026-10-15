/**
 * Pruebas de los textos editoriales del inicio (content/pages/<idioma>/home.json).
 *   npm run test:home
 * Comprueba que los cuatro idiomas tienen las mismas secciones y el mismo número de elementos
 * (así no se muestra una sección con menos tarjetas en un idioma).
 */
import assert from 'node:assert/strict';
import { getHomePage } from '../src/lib/home/index.ts';

const LOCALES = ['en', 'es', 'pt', 'fr'];
const home = Object.fromEntries(await Promise.all(LOCALES.map(async (l) => [l, await getHomePage(l)])));

const shape = (h) => ({
  heroMetrics: h.hero.metrics.length,
  aboutCards: h.about.cards.length,
  challenges: h.challenges.items.length,
  phases: Object.keys(h.process.phases).sort().join(','),
  phaseItems: Object.values(h.process.phases).map((p) => p.items.length).join(','),
  why: h.why.items.length,
  gain: h.why.gain.items.length,
  faq: h.faq.items.length,
  ctaSteps: h.cta.steps.length,
});

const tests = [
  ['las mismas secciones y el mismo número de elementos en los cuatro idiomas', () => {
    const base = shape(home.en);
    for (const l of LOCALES) assert.deepEqual(shape(home[l]), base, l);
  }],
  ['ningún texto de sección vacío', () => {
    for (const l of LOCALES) {
      const h = home[l];
      for (const s of [h.hero.eyebrow, h.hero.title, h.hero.lede, h.about.title, h.challenges.title, h.solutions.title, h.solutions.groupTitle, h.process.title, h.why.title, h.faq.title, h.cta.title]) {
        assert.ok(typeof s === 'string' && s.trim(), l);
      }
    }
  }],
  ['preguntas frecuentes con pregunta y respuesta', () => {
    for (const l of LOCALES) for (const q of home[l].faq.items) assert.ok(q.question.trim() && q.answer.trim(), l);
  }],
];

let passed = 0;
console.log('Inicio: textos editoriales (contenido real)');
for (const [name, fn] of tests) {
  fn();
  passed++;
  console.log('  ✓', name);
}
console.log(`\n${passed} pruebas OK`);
