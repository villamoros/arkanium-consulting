import { defaultLocale, locales } from '../../i18n/config.ts';
import { siteConfig } from '../../content/static/site.ts';

/** Single source of truth for public SEO identity. */
export const seoConfig = {
  siteName: siteConfig.name,
  siteUrl: 'https://arkaniumconsulting.com',
  defaultLocale,
  supportedLocales: locales,
  defaultOgImage: siteConfig.defaultOgImage,
  organization: {
    name: siteConfig.name,
    logo: siteConfig.assets.logoMark,
    description: 'Digital infrastructure engineering firm specializing in legacy modernization, software architecture, and fractional CTO services.',
  },
  socialProfiles: [siteConfig.linkedin],
} as const;
