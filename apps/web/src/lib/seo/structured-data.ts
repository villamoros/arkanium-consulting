import { seoConfig } from './config.ts';

type JsonLd = Record<string, unknown>;

export interface BreadcrumbItem { name: string; url: string }

export function globalSchemas(siteUrl: string): JsonLd[] {
  const url = siteUrl.replace(/\/$/, '');
  return [
    { '@context': 'https://schema.org', '@type': 'Organization', name: seoConfig.organization.name, legalName: seoConfig.organization.legalName, url, logo: new URL(seoConfig.organization.logo, `${url}/`).toString(), sameAs: seoConfig.socialProfiles },
    { '@context': 'https://schema.org', '@type': 'ProfessionalService', name: seoConfig.organization.name, legalName: seoConfig.organization.legalName, url, description: seoConfig.organization.description, areaServed: 'Worldwide' },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: seoConfig.siteName, url },
  ];
}

export function breadcrumbSchema(items: BreadcrumbItem[]): JsonLd | undefined {
  if (!items.length) return undefined;
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })) };
}

export function articleSchema(input: { url: string; headline: string; description: string; image?: string; datePublished?: string; dateModified?: string; author?: string }): JsonLd {
  const schema: JsonLd = {
    '@context': 'https://schema.org', '@type': 'Article', mainEntityOfPage: { '@type': 'WebPage', '@id': input.url }, headline: input.headline,
    description: input.description, publisher: { '@type': 'Organization', name: seoConfig.siteName, url: seoConfig.siteUrl },
  };
  if (input.image) schema.image = input.image;
  if (input.datePublished) schema.datePublished = input.datePublished;
  if (input.dateModified) schema.dateModified = input.dateModified;
  if (input.author) schema.author = { '@type': 'Person', name: input.author };
  return schema;
}
