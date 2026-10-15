import { seoConfig } from './config.ts';

export type OpenGraphType = 'website' | 'article';

export interface MetadataInput {
  title?: string;
  description?: string;
  ogImage?: string;
  ogType?: OpenGraphType;
}

/** Keeps the brand suffix consistent while accepting existing CMS titles that include it. */
export function pageTitle(title: string | undefined, fallback: string): string {
  const value = (title || fallback).trim();
  return value.includes(seoConfig.siteName) ? value : `${value} | ${seoConfig.siteName}`;
}

export function pageDescription(description: string | undefined, fallback: string): string {
  return (description || fallback).trim();
}
