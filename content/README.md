# Contenido local

Fuente de contenido del sitio mientras no esté conectado el CMS (Storyblok, pendiente).
Se lee con `graphql-js` en proceso (`src/lib/content/`). No es un CMS: se edita como archivos y se versiona con git.

## Estructura

```text
content/
  insights/
    en/   <id>.json   un archivo por artículo y por idioma
    es/
    pt/
    fr/
```

Cada idioma es independiente: un artículo solo existe en un idioma si tiene archivo en esa carpeta.
No hay fallback al inglés. Los archivos que empiezan por `_` se ignoran.

Un artículo publicado debe incluir `publishedAt` (fecha ISO en el pasado) y `editorialStatus: "READY"`.
Las reglas exactas están en `src/lib/insights/normalize.ts`.

## Servicios (`content/services/<idioma>/<valor>.json`)

Alcance vigente: 42 servicios en tres familias (Strategy, Product, Architecture), en los cuatro idiomas.
Cada archivo contiene la familia y la categoría (con su orden), y el servicio:

- `value`: identificador estable y slug de la URL (`/{idioma}/solutions/{familia}/{valor}/`). Es el mismo en los cuatro idiomas.
- `label` y `name`: nombre en el idioma. Hoy son iguales; `label` se usa en menús y acordeones.
- `duration`: **vacía (`null`)**. La define el owner. No mostrar plazos inventados.
- `description`, `problem`, `solution`, `outcomes`: textos **borrador para revisión** del owner antes de publicar.

Los servicios fuera de este alcance no existen en el contenido. No se muestran como «próximamente».
Las pruebas de integridad (`npm run test:services`) comprueban que los cuatro idiomas tienen los mismos valores y campos completos.

## Páginas legales (`content/legal/<idioma>/<página>.json`)

Cuatro documentos por idioma: `privacy`, `terms`, `cookies`, `disclaimer`. Cada uno tiene `title`, `description` y `sections` (párrafos).
Los textos son los originales de la página, sin cambios. Son **borradores de texto legal**: deben revisarlos abogados antes de publicarse.
Las pruebas (`npm run test:legal`) comprueban que los cuatro documentos existen en los cuatro idiomas.
