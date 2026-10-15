import { seoConfig } from './config.ts';

/** Canonicals always use the public HTTPS host and discard tracking/query parameters. */
export function canonicalUrl(pathOrUrl: string, site: URL | undefined): string {
  const url = new URL(pathOrUrl, site ?? seoConfig.siteUrl);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export const absoluteSeoUrl = (pathOrUrl: string, site?: URL) => canonicalUrl(pathOrUrl, site);
