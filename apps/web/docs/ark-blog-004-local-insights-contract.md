# Contrato — Blog (Insights) con contenido local

**Estado:** aprobado en diseño (estética y arquitectura). Implementación en curso.
**Fecha:** 2026-10-14.
**Sustituye, para el MVP, al plan de integración con Storyblok de ARK-BLOG-002/003 mientras el CMS está pendiente.** La forma de los datos se mantiene para que la migración a Storyblok cambie el transporte, no las páginas.

## 1. Alcance

- Listado `/{idioma}/insights/` con artículo destacado (opcional) y cuadrícula paginada de 12.
- Paginación estática `/{idioma}/insights/page/{n}/`.
- Artículo `/{idioma}/insights/{slug}/` con formato, categoría, portada, índice (en escritorio lateral, en móvil desplegable) y bloque de autor opcional.
- Teaser del inicio: los 3 artículos más recientes del idioma (orden por fecha, no por destacado).
- Fuera del MVP: archivos por categoría y por etiqueta, búsqueda, comentarios, mini CMS y dashboard.

## 2. Almacenamiento

| Qué | Dónde | Formato |
| --- | --- | --- |
| Artículo | `content/insights/<idioma>/<id>.json` | Un archivo por idioma. Sin fallback. |
| Autor | `content/authors/<idioma>/<id>.json` | Nombre, enlaces y rol/biografía por idioma. Opcional en cada artículo. |
| Imagen de portada | `public/images/insights/<slug>.<ext>` | Ruta pública y dimensiones en el artículo. |

## 3. Campos del artículo

| Campo | Obligatorio para publicar | Notas |
| --- | --- | --- |
| `id` | Sí | Identidad estable entre idiomas. |
| `slug` | Sí | Por idioma. Único por idioma. Minúsculas, números y guiones. |
| `title`, `excerpt` | Sí | Sin traducción no hay página en ese idioma. |
| `publishedAt` | Sí | Fecha editorial. Nunca se sustituye por la de actualización. |
| `editorialStatus` | No | Si existe, debe ser `READY`. |
| `format` | Sí | `analysis` o `guide`. |
| `category` | Sí | Una sola: `{ value, name }`. |
| `content` | Sí | Rich Text saneado (sin bloques). |
| `featured` | No | Como máximo uno por idioma. Si hay más, el más reciente se destaca y se avisa. |
| `featuredImage` | No | `{ url, width, height, caption? }`. |
| `coverAlt` | Sí si hay portada | Texto alternativo de la portada. |
| `author` | No | `id` de un autor en el mismo idioma. Si no existe, no se muestra byline. |
| `seo` | No | `metaTitle`, `metaDescription`, `noIndex`, `ogImage`, `canonicalUrl`. |
| `relatedArticles` | No | Ids de otros artículos. Solo los que existen en el idioma. |

## 4. Reglas de publicación

1. Un artículo es público en un idioma si tiene título, slug y extracto en ese idioma, `publishedAt` ya pasó y `editorialStatus` es `READY` o no existe.
2. Un artículo público **sin** `format`, `category` o `coverAlt` (cuando hay portada) **rompe el build**: es un error editorial que no se oculta.
3. Un JSON mal formado rompe el build, nombrando el archivo.
4. El orden del listado y del teaser es por `publishedAt` descendente. El destacado no altera el orden.
5. La paginación se aplica después del filtro de publicación.

## 5. Consultas GraphQL

- `articles(locale)`: todos los artículos del idioma (la publicación se filtra en `normalize.ts`). Cada artículo incluye su autor resuelto desde `content/authors/<idioma>`.
- `article(locale, slug)`: detalle.
- La paginación no va en GraphQL: se aplica después de filtrar lo publicado.

## 6. Estética

Definida en la revisión de diseño: mismos tokens, Orbitron solo en H1 y H2, dorado como único acento, tarjetas de borde fino, etiqueta de formato con borde dorado, portada por defecto (marca sobre la rejilla) cuando falta la imagen, índice lateral en escritorio y desplegable en móvil.

## 7. Autores

El campo `author` queda como variable: en el MVP los artículos pueden no tener autor. Cuando exista el mini CMS, el autor se escribirá o se elegirá de un banco de colaboradores que representa `content/authors/`.

## 8. Pruebas y verificación

- Pruebas unitarias de publicación, validación, paginación, índice y resolución de autor (`npm run test:insights`, `npm run test:blog`).
- Build con artículos de prueba temporales en cada idioma, verificados y luego eliminados.

## 9. Pendientes fuera de este contrato

- Esquema JSON formal para el dashboard (se escribirá con ese proyecto).
- Texto de la portada por defecto y de las etiquetas de formato: revisión de copy.
- Decisiones del contrato de captación que siguen abiertas (consentimiento, Slack, retención).
