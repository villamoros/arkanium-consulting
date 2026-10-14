import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

// Fuente única de la URL pública. Usada por Astro (`Astro.site`) para
// canonical, hreflang y URLs absolutas de Open Graph.
const site = env.PUBLIC_SITE_URL || 'https://arkaniumconsulting.com';

const xml = (value) => value.replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const attribute = (html, name) => new RegExp(`<link\\s+[^>]*rel=["']${name}["'][^>]*href=["']([^"']+)["']`, 'i').exec(html)?.[1];
const alternates = (html) => [...html.matchAll(/<link\s+[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map((m) => ({ lang: m[1], url: m[2] }));

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? htmlFiles(`${directory}/${entry.name}`)
    : entry.isFile() && entry.name === 'index.html' ? [`${directory}/${entry.name}`] : []));
  return nested.flat();
}

/**
 * The official integration discovers static routes. This final pass applies the same HTML
 * canonical/hreflang/noindex contract to the emitted sitemap, including CMS-specific translated slugs.
 */
function seoSitemap() {
  return {
    name: 'arkanium-seo-sitemap',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const output = fileURLToPath(dir);
        const pages = [];
        for (const file of await htmlFiles(output)) {
          const html = await readFile(file, 'utf8');
          if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) continue;
          const canonical = attribute(html, 'canonical');
          if (canonical) pages.push({ url: canonical, links: alternates(html) });
        }
        const body = pages.map((page) => `  <url>\n    <loc>${xml(page.url)}</loc>${page.links.map((link) => `\n    <xhtml:link rel="alternate" hreflang="${xml(link.lang)}" href="${xml(link.url)}" />`).join('')}\n  </url>`).join('\n');
        const map = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
        await writeFile(`${output}/sitemap-0.xml`, map, 'utf8');
      },
    },
  };
}

export default defineConfig({
  site,
  output: 'static',
  // Convención única: trailing slash en páginas (/en/, /en/solutions/).
  trailingSlash: 'always',
  build: { format: 'directory' },
  // `/` no es una versión distinta de `/en/`: redirige de forma permanente.
  // En salida estática Astro genera una página de redirección (meta refresh);
  // el 301 real depende del hosting (ver README → Redirect de `/`).
  // Si cambia el idioma por defecto, actualizar el destino (i18n/config.ts → defaultLocale).
  redirects: { '/': { status: 301, destination: '/en/' } },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es', pt: 'pt', fr: 'fr' } },
      filter: (page) => !page.endsWith('/404/'),
    }),
    seoSitemap(),
  ],
});
