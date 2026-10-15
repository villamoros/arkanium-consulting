/**
 * Pruebas de la lógica del consentimiento de cookies (src/lib/consent/state.ts).
 *   npm run test:consent
 * Sin elección guardada no se permite nada opcional; la cookie ida y vuelta conserva la elección.
 */
import assert from 'node:assert/strict';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  allows,
  consentCookie,
  parseConsent,
  readConsentCookie,
  serializeConsent,
} from '../src/lib/consent/state.ts';

const NOW = new Date('2026-10-14T12:00:00.000Z');
let passed = 0;
console.log('Consentimiento de cookies');

const tests = [
  ['sin elección no se permite ninguna categoría opcional', () => {
    assert.equal(allows(null, 'analytics'), false);
    assert.equal(allows(null, 'marketing'), false);
  }],
  ['parseConsent rechaza vacío, corrupto y otra versión', () => {
    assert.equal(parseConsent(undefined), null);
    assert.equal(parseConsent(''), null);
    assert.equal(parseConsent('{no-json'), null);
    assert.equal(parseConsent(JSON.stringify({ version: 2, analytics: true, marketing: true })), null);
    assert.equal(parseConsent(JSON.stringify({ version: 1, analytics: 'yes', marketing: false })), null);
  }],
  ['serializar y leer devuelve la misma elección', () => {
    const raw = serializeConsent({ analytics: true, marketing: false }, NOW);
    const parsed = parseConsent(raw);
    assert.equal(parsed?.analytics, true);
    assert.equal(parsed?.marketing, false);
    assert.equal(parsed?.savedAt, NOW.toISOString());
  }],
  ['la cookie tiene nombre, ruta, duración y SameSite', () => {
    const cookie = consentCookie({ analytics: false, marketing: false }, NOW, false);
    assert.ok(cookie.startsWith(`${CONSENT_COOKIE}=`));
    assert.ok(cookie.includes(`Max-Age=${CONSENT_MAX_AGE_SECONDS}`));
    assert.ok(cookie.includes('Path=/'));
    assert.ok(cookie.includes('SameSite=Lax'));
    assert.ok(!cookie.includes('Secure'));
  }],
  ['en https la cookie se marca Secure', () => {
    assert.ok(consentCookie({ analytics: false, marketing: false }, NOW, true).includes('; Secure'));
  }],
  ['ida y vuelta: la cookie escrita se lee del header del navegador', () => {
    const choice = { analytics: true, marketing: false };
    const written = consentCookie(choice, NOW, true).split(';')[0];
    const header = `theme=dark; ${written}; other=1`;
    const read = readConsentCookie(header);
    assert.equal(read?.analytics, true);
    assert.equal(read?.marketing, false);
    assert.equal(allows(read, 'analytics'), true);
    assert.equal(allows(read, 'marketing'), false);
  }],
  ['sin la cookie, readConsentCookie devuelve null', () => {
    assert.equal(readConsentCookie('theme=dark; other=1'), null);
    assert.equal(readConsentCookie(''), null);
  }],
  ['una cookie corrupta no lanza error', () => {
    assert.equal(readConsentCookie(`${CONSENT_COOKIE}=%E0%A4%A`), null);
    assert.equal(readConsentCookie(`${CONSENT_COOKIE}=not-json`), null);
  }],
];

for (const [name, fn] of tests) {
  fn();
  passed++;
  console.log('  ✓', name);
}
console.log(`\n${passed} pruebas OK`);
