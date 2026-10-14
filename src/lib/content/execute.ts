/**
 * Ejecutor GraphQL en proceso (graphql-js). Sin servidor HTTP: el build consulta el esquema directamente.
 * El contenido vive en `content/` (raíz del proyecto), salvo que se pase otra raíz (pruebas).
 */
import { buildSchema, graphql } from 'graphql';
import path from 'node:path';
import { CONTENT_SDL } from './schema.ts';
import { readCollection } from './store.ts';
import { groupServices } from './services.ts';

const schema = buildSchema(CONTENT_SDL);

export const DEFAULT_CONTENT_ROOT = path.resolve(process.cwd(), 'content');

export async function runContentQuery<T>(
  source: string,
  variables: Record<string, unknown> = {},
  contentRoot: string = DEFAULT_CONTENT_ROOT,
): Promise<T> {
  const rootValue = {
    articles: ({ locale }: { locale: string }) => readCollection(contentRoot, 'insights', locale),
    article: async ({ locale, slug }: { locale: string; slug: string }) => {
      const items = await readCollection(contentRoot, 'insights', locale);
      return items.find((item) => item.slug === slug) ?? null;
    },
    serviceFamilies: async ({ locale }: { locale: string }) => groupServices(await readCollection(contentRoot, 'services', locale)),
    legalPages: ({ locale }: { locale: string }) => readCollection(contentRoot, 'legal', locale),
  };

  const result = await graphql({ schema, source, rootValue, variableValues: variables });
  if (result.errors?.length) {
    throw new Error(`[content] ${result.errors.map((e) => e.message).join('; ')}`);
  }
  return result.data as T;
}
