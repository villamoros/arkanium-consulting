/// <reference path="../.astro/types.d.ts" />

/** Variables de build y de navegador. Las PUBLIC_ llegan al navegador: solo claves públicas y URLs. */
interface ImportMetaEnv {
  /** Clave pública de Clerk (pk_…). */
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  /** URL base de la API (sin barra final). */
  readonly PUBLIC_API_URL: string;
  /** Destinos tras iniciar sesión. */
  readonly PUBLIC_APP_URL: string;
  readonly PUBLIC_CORE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
