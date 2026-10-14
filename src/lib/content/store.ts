/**
 * Lectura de colecciones locales: content/<colección>/<idioma>/<archivo>.json
 * Cada idioma es una carpeta propia, así que no existe fallback entre idiomas por construcción.
 * Los archivos se tratan como entrada externa: se valida que sean objetos JSON y el error nombra el archivo.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function readCollection(root: string, collection: string, locale: string): Promise<Record<string, unknown>[]> {
  const dir = path.join(root, collection, locale);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const items: Record<string, unknown>[] = [];
  for (const name of names.filter((n) => n.endsWith('.json') && !n.startsWith('_')).sort()) {
    const text = await readFile(path.join(dir, name), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`[content] ${collection}/${locale}/${name}: JSON no válido.`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`[content] ${collection}/${locale}/${name}: se esperaba un objeto JSON.`);
    }
    items.push(parsed as Record<string, unknown>);
  }
  return items;
}
