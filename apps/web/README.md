# Arkanium Web

Sitio corporativo de Arkanium Consulting. Astro + TypeScript, salida estática.

## Requisitos

Node ≥ 22.12

## Comandos

| Comando           | Acción                                |
| ----------------- | ------------------------------------- |
| `npm install`     | Instala dependencias                  |
| `npm run dev`     | Servidor de desarrollo (localhost:4321) |
| `npm run build`   | Build estático en `dist/`             |
| `npm run preview` | Sirve `dist/` localmente              |
| `npm run check`   | Type-check de Astro/TypeScript        |

Copia `.env.example` a `.env` y ajusta `PUBLIC_SITE_URL`.

## Estructura

```
public/                 fonts/, images/, icons/, favicon.svg, robots.txt
src/
  components/
    layout/             Header, Footer, Navigation, LanguageSwitcher
    sections/           Una por sección del Home
    ui/                 Piezas reutilizables (Button, SectionHeading, ...)
  layouts/
    BaseLayout.astro    <html>, <head>, SEO foundation, estilos globales
    PageLayout.astro    BaseLayout + Header/main/Footer
  i18n/                 config.ts (locales), utils.ts (rutas + traducciones), en/es/pt/fr.ts
  pages/                [locale]/index.astro (Home), 404.astro
  styles/
    tokens.css          Variables del design system
    global.css          @font-face, reset, base, tipografía
    components.css      Estilos de componentes y responsive
  lib/                  site.ts (SEO/URL helpers), utils.ts
  content/static/       site.ts (identidad), services.ts / icons.ts (datos estructurales)
```

## Convenciones

- Componentizar por responsabilidad visual/funcional, no por cada `<div>`.
- Si el navegador lo resuelve con HTML/CSS nativo, no se añade JavaScript.
- Cero secretos en el cliente. Solo variables `PUBLIC_*` son visibles al navegador.
- Sin arquitectura especulativa: CMS (Storyblok), blog y catálogo llegan con sus tickets.

## Contenido (CMS)

Hygraph fue retirado del proyecto. La conexión con Storyblok (GraphQL) está pendiente; hasta entonces el catálogo, los casos y los insights se construyen vacíos (ver `src/lib/cms/pending.ts`).

## Fuentes

Autoalojadas en `public/fonts` (subset latin, variable fonts, licencia OFL):
Orbitron (400–900) y Exo 2 (100–900).

## Internacionalización (ARK-WEB-003)

- Idiomas: `en` (por defecto), `es`, `pt`, `fr` → `/en/`, `/es/`, `/pt/`, `/fr/` (trailing slash siempre).
  Lista única en `src/i18n/config.ts`.
- **La URL es la fuente de verdad.** Sin `localStorage`, sin `navigator.language`, sin traducción en cliente.
- `src/i18n/en.ts` define el esquema (`TranslationSchema`); `es/pt/fr.ts` deben cumplirlo (TypeScript falla si falta o sobra una clave).
- Los componentes son agnósticos del idioma: reciben `content` (y `ui`) por props. Nada de `if (locale === …)`.
- Rutas: `getLocalizedPath(locale, '/solutions/')`, `getAlternateLocalePath(pathname, locale)` (`src/i18n/utils.ts`).
- Política de claves faltantes: fallback a inglés + `console.warn` (dev y build). Nunca `undefined`.
- SEO: `BaseLayout` genera `<html lang>`, canonical propio por idioma, `hreflang` (+ `x-default` → EN) y `og:locale`.
- **Nueva página localizada:** crear `src/pages/[locale]/<ruta>/index.astro` con `getStaticPaths` sobre `locales`.
- **Nuevo idioma:** añadirlo a `config.ts`, crear su diccionario y registrarlo en `utils.ts`.
- i18n ≠ CMS: aquí vive navegación, UI, CTAs y contenido estático temporal; Services/Case Studies/Insights irán al CMS (Storyblok).

### Redirect de `/`
`/` → `/en/` (301 declarado en `astro.config.mjs`). En salida estática Astro emite una página con
`meta refresh` + canonical a `/en/`; para un 301 real configurar el hosting
(p. ej. `/  /en/  301` en `_redirects` de Netlify/Cloudflare Pages, o `redirects` en `vercel.json`).

## Solutions / Service Catalog (ARK-WEB-004)

- Jerarquía: **Solutions → Family → Category → Service → Offering**. Rutas (por idioma):
  `/solutions/`, `/solutions/{family}/`, `/solutions/{family}/{service}/` (`src/pages/[locale]/solutions/…`).
- Fuente de contenido: **pendiente, Storyblok (GraphQL)**. Hasta integrarla, `src/lib/catalog/index.ts` devuelve un catálogo vacío y avisa en consola.
- Generación **estática**: una consulta por idioma y build; el mega-menú se emite como HTML.
- Un servicio solo tiene página si tiene contenido real. Los precios se muestran únicamente según `investmentVisibility` (por defecto, ninguno).
- CTA: `/{locale}/?service=…&offering=…#cta` (el envío real del formulario es otra tarea).
- Los textos de interfaz (títulos de sección, etiquetas) siguen en `src/i18n`; el contenido comercial, en el CMS.

## Case Studies (ARK-WEB-005)
- Rutas: `/{locale}/case-studies/` y `/{locale}/case-studies/{slug}/`.
- Reglas de integridad en `src/lib/case-studies/normalize.ts`; `npm run test:integrity` las prueba. Las reglas rompen el build si un caso publicado las incumple.
- Fuente pendiente (Storyblok): sin CMS conectado no hay casos.

## Insights (ARK-WEB-006)
- Rutas: `/{locale}/insights/` y `/{locale}/insights/{slug}/` (slug **por idioma**).
- Reglas de publicación y saneado del Rich Text en `src/lib/insights/`. `npm test` ejecuta las pruebas de Case Studies e Insights.
- Fuente pendiente (Storyblok): sin CMS conectado no hay artículos; la sección del Home muestra "Próximamente".
