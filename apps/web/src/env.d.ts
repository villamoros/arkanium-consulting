/// <reference path="../.astro/types.d.ts" />

/** Variables de servidor/build (sin prefijo PUBLIC_: nunca llegan al navegador). Ninguna definida: el CMS (Storyblok) está pendiente. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ImportMetaEnv {}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
