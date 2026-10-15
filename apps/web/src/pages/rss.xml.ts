import rss from '@astrojs/rss';
import { seoConfig } from '../lib/seo';
import { rssItems } from '../lib/seo/rss';

/** The root feed is deliberately English; localized feeds live at /{locale}/rss.xml. */
export async function GET(context: { site?: URL }) {
  return rss({
    title: `${seoConfig.siteName} Insights`,
    description: `Latest public insights from ${seoConfig.siteName}.`,
    site: context.site ?? new URL(seoConfig.siteUrl),
    items: await rssItems('en'),
    customData: '<language>en</language>',
  });
}
