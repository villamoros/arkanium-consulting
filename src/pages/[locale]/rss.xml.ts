import rss from '@astrojs/rss';
import { locales, type Locale } from '../../i18n/config';
import { seoConfig } from '../../lib/seo';
import { rssItems } from '../../lib/seo/rss';

export function getStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}

export async function GET(context: { site?: URL; params: { locale?: string } }) {
  const locale = context.params.locale as Locale;
  return rss({
    title: `${seoConfig.siteName} Insights (${locale.toUpperCase()})`,
    description: `Latest public insights from ${seoConfig.siteName}.`,
    site: context.site ?? new URL(seoConfig.siteUrl),
    items: await rssItems(locale),
    customData: `<language>${locale}</language>`,
  });
}
