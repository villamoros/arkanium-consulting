import { seoConfig } from '../lib/seo';

export function GET() {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${seoConfig.siteUrl}/sitemap-index.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
