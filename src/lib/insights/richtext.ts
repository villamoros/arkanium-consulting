/**
 * Rich Text del CMS (AST JSON `raw`) → árbol saneado.
 *
 * Seguridad por construcción: NO se genera HTML a partir del CMS. Solo se aceptan tipos de nodo de una
 * lista blanca; los desconocidos se desenvuelven (se conserva el texto, se pierde la etiqueta). Los enlaces
 * solo admiten https/http/mailto/rutas relativas. Astro renderiza el árbol con sus propios elementos
 * (RichText.astro), de modo que el texto siempre se escapa.
 */
export type RtMarks = { bold?: boolean; italic?: boolean; underline?: boolean; code?: boolean };
export type BlockTag = 'p' | 'h2' | 'h3' | 'h4' | 'h5' | 'ul' | 'ol' | 'li' | 'blockquote' | 'pre';
export type RtNode =
  | { kind: 'text'; text: string; marks: RtMarks }
  | { kind: 'block'; tag: BlockTag; children: RtNode[] }
  | { kind: 'link'; href: string; external: boolean; newTab: boolean; children: RtNode[] }
  | { kind: 'image'; src: string; alt: string; width?: number; height?: number };

// Los h1 del contenido bajan un nivel: la página ya tiene su <h1> (título del artículo).
const BLOCKS: Record<string, BlockTag> = {
  paragraph: 'p', 'heading-one': 'h2', 'heading-two': 'h3', 'heading-three': 'h4',
  'heading-four': 'h5', 'heading-five': 'h5', 'heading-six': 'h5',
  'bulleted-list': 'ul', 'numbered-list': 'ol', 'list-item': 'li', 'block-quote': 'blockquote', 'code-block': 'pre',
};
const MAX_DEPTH = 12;

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

function safeHref(value: unknown): { href: string; external: boolean } | undefined {
  if (typeof value !== 'string') return undefined;
  const href = value.trim();
  if (href.startsWith('/') && !href.startsWith('//')) return { href, external: false };
  if (href.startsWith('#')) return { href, external: false };
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' || url.protocol === 'http:') return { href: url.toString(), external: true };
    if (url.protocol === 'mailto:') return { href: url.toString(), external: false };
  } catch { /* esquema inválido → se descarta */ }
  return undefined;
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch { return undefined; }
}

function convert(node: unknown, depth: number): RtNode[] {
  if (depth > MAX_DEPTH || !isObj(node)) return [];
  const children = (): RtNode[] => (Array.isArray(node.children) ? node.children.flatMap((c) => convert(c, depth + 1)) : []);

  if (typeof node.text === 'string') {
    if (node.text === '') return [];
    const marks: RtMarks = {};
    if (node.bold === true) marks.bold = true;
    if (node.italic === true) marks.italic = true;
    if (node.underline === true) marks.underline = true;
    if (node.code === true) marks.code = true;
    return [{ kind: 'text', text: node.text, marks }];
  }

  const type = typeof node.type === 'string' ? node.type : '';
  const tag = BLOCKS[type];
  if (tag) return [{ kind: 'block', tag, children: children() }];

  if (type === 'link') {
    const target = safeHref(node.href);
    const kids = children();
    // Enlace con esquema no permitido (p. ej. javascript:): se conserva el texto, se elimina el enlace.
    return target ? [{ kind: 'link', ...target, newTab: node.openInNewTab === true, children: kids }] : kids;
  }

  if (type === 'image') {
    const src = httpsUrl(node.src);
    if (!src) return [];
    const alt = typeof node.altText === 'string' ? node.altText : typeof node.title === 'string' ? node.title : '';
    const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined);
    return [{ kind: 'image', src, alt, width: num(node.width), height: num(node.height) }];
  }

  // Tipos no soportados (iframe, video, class, list-item-child, …): se desenvuelve su contenido de texto.
  return children();
}

/** raw → árbol saneado. Un AST con forma inválida rompe el build (no se publica contenido corrupto). */
export function sanitizeRichText(raw: unknown, context: string): RtNode[] {
  const root = typeof raw === 'string' ? safeParse(raw) : raw;
  const children = isObj(root) ? root.children : Array.isArray(root) ? root : undefined;
  if (!Array.isArray(children)) throw new Error(`[insights] Rich Text inválido en ${context}: se esperaba { children: [...] }.`);
  return children.flatMap((c) => convert(c, 0));
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}

export function plainText(nodes: RtNode[]): string {
  return nodes
    .map((n) => (n.kind === 'text' ? n.text : n.kind === 'image' ? '' : plainText(n.children)))
    .join(' ');
}

/** Tiempo de lectura derivado del contenido (no se almacena en el CMS). */
export function readingMinutes(nodes: RtNode[], wordsPerMinute = 200): number {
  const words = plainText(nodes).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}
