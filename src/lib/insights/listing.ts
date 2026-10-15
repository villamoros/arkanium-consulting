/**
 * Piezas puras del listado y del artículo: destacado, paginación e índice (contrato ARK-BLOG-004).
 * Sin I/O: todo se calcula sobre los resúmenes ya filtrados por publicación.
 */
import { plainText, type RtNode } from './richtext.ts';
import type { ArticleSummary } from './types.ts';

export const PAGE_SIZE = 12;

export interface Listing {
  /** El destacado más reciente (si existe). Solo aparece en la primera página. */
  highlight?: ArticleSummary;
  /** Resto de artículos, en orden de fecha. */
  items: ArticleSummary[];
}

/** `all` llega ordenado por fecha; el destacado se toma del más reciente y no se repite en la cuadrícula. */
export function splitListing(all: ArticleSummary[]): Listing {
  const highlight = all.find((a) => a.featured);
  return { highlight, items: all.filter((a) => a !== highlight) };
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export function pageOf<T>(items: T[], page: number, size = PAGE_SIZE): T[] {
  const start = (page - 1) * size;
  return items.slice(start, start + size);
}

/** Asigna id estable (`sec-N`) a los H2 de nivel superior para que el índice pueda enlazarlos. */
export function withHeadingIds(nodes: RtNode[]): RtNode[] {
  let n = 0;
  return nodes.map((node) => (node.kind === 'block' && node.tag === 'h2' ? { ...node, id: `sec-${++n}` } : node));
}

export interface TocEntry {
  id: string;
  text: string;
}

export function tableOfContents(nodes: RtNode[]): TocEntry[] {
  return withHeadingIds(nodes).flatMap((node) =>
    node.kind === 'block' && node.tag === 'h2' && node.id ? [{ id: node.id, text: plainText(node.children).trim() }] : [],
  );
}

/** El índice solo se muestra si hay al menos dos secciones: uno solo no ayuda a navegar. */
export const showToc = (toc: TocEntry[]): boolean => toc.length >= 2;
