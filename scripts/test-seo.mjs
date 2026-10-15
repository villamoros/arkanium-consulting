import assert from 'node:assert/strict';
import { canonicalUrl, isIndexable, localeAlternates, pageTitle } from '../src/lib/seo/index.ts';

const same = (actual, expected, label) => {
  assert.deepEqual(actual, expected);
  console.log(`  ✓ ${label}`);
};

console.log('SEO integrity');
same(canonicalUrl('/es/solutions/foo/?utm_source=linkedin#overview'), 'https://arkanium.consulting/es/solutions/foo/', 'canonical removes query parameters and fragments');
same(pageTitle('Architecture Consulting', 'fallback'), 'Architecture Consulting | Arkanium Consulting', 'page title receives the branded suffix once');
same(
  localeAlternates('/en/insights/legacy-architecture/', {
    en: '/en/insights/legacy-architecture/',
    es: '/es/insights/arquitectura-heredada/',
    fr: '/fr/insights/architecture-legacy/',
  }).map((item) => item.locale),
  ['en', 'es', 'fr'],
  'missing translations do not create hreflang targets',
);
same(isIndexable({ published: true }), true, 'published public content is indexable');
same(isIndexable({ noIndex: true, published: true }), false, 'noindex content is excluded from discovery');
same(isIndexable({ visibility: 'UNLISTED', published: true }), false, 'unlisted content is excluded from discovery');
console.log('\n6 SEO checks OK');
