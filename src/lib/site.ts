import { siteConfig } from '../content/static/site';

/** URL absoluta a partir de una ruta, usando `Astro.site` (PUBLIC_SITE_URL). */
export function absoluteUrl(path: string, site: URL | undefined): string {
  return new URL(path, site ?? 'https://arkaniumconsulting.com').toString();
}

/** JSON-LD base (Organization + ProfessionalService + WebSite), migrado del index.html original. */
export function baseSchema(siteUrl: string) {
  const url = siteUrl.replace(/\/$/, '');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteConfig.name,
      url,
      logo: `${url}/assets/arkanium-mark.png`,
      sameAs: { 
        [siteConfig.linkedin]: siteConfig.linkedin,
        [siteConfig.x]: siteConfig.x,
        [siteConfig.instagram]: siteConfig.instagram,
        [siteConfig.facebook]: siteConfig.facebook,
        [siteConfig.tiktok]: siteConfig.tiktok,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: siteConfig.name,
      url,
      description:
        'Digital infrastructure engineering firm specializing in legacy system modernization, software architecture, and fractional CTO services.',
      serviceType: [
        'Architecture Assessment',
        'Legacy Modernization',
        'Fractional CTO',
        'Engineering Governance & Architecture Review',
      ],
      areaServed: 'Worldwide',
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: siteConfig.name, url },
  ];
}
