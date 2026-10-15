import type { Locale } from '../../i18n/config.ts';
import { articlePath, getArticleSummaries } from '../insights/index.ts';
import { isIndexable } from './indexability.ts';

/** Lightweight, language-specific RSS entries. Rich Text is intentionally not fetched for feeds. */
export async function rssItems(locale: Locale) {
  const articles = await getArticleSummaries(locale);
  return articles
    .filter((article) => isIndexable({ noIndex: article.noIndex, published: true }))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .map((article) => ({
      title: article.title,
      description: article.excerpt,
      link: articlePath(locale, article.slug),
      pubDate: new Date(article.publishedAt),
      author: article.author?.name,
      categories: [article.category.name],
      customData: article.featuredImage ? `<enclosure url="${escapeXml(article.featuredImage.url)}" type="image/*" />` : undefined,
    }));
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[character]!));
}
