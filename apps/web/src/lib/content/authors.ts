/**
 * Autores del blog: content/authors/<idioma>/<id>.json. Cada idioma tiene su rol y biografía.
 * Un artículo referencia al autor por `id`. Si la referencia no existe, el artículo se muestra sin byline y se avisa.
 */
import { readCollection } from './store.ts';

export async function readAuthors(root: string, locale: string): Promise<Map<string, Record<string, unknown>>> {
  const items = await readCollection(root, 'authors', locale);
  return new Map(items.map((a) => [String(a.id), a]));
}

export function withAuthors(items: Record<string, unknown>[], authors: Map<string, Record<string, unknown>>, locale: string): Record<string, unknown>[] {
  return items.map((item) => {
    if (typeof item.author !== 'string') return item;
    const found = authors.get(item.author);
    if (!found) console.warn(`[content] artículo "${String(item.slug)}" (${locale}): el autor "${item.author}" no existe; no se muestra byline.`);
    return { ...item, author: found ?? null };
  });
}
