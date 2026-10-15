/**
 * Configuración estática del sitio (identidad). Idiomas: ver i18n/config.ts.
 * Textos de interfaz y metadatos por idioma: ver i18n/*.ts.
 */
export const siteConfig = {
  name: 'Arkanium Consulting LLC, New Mexico - USA',
  // Active production assets in public/images.
  defaultOgImage: '/images/arkanium-logo-lockup.png',
  assets: {
    logoMark: '/images/arkanium-mark.png',
    logoLockup: '/images/arkanium-logo-lockup.png',
  },
  // Placeholder: la página de acceso aún no existe. Cambiar cuando se defina el portal de login.
  loginPath: '/login/',
  linkedin: 'https://www.linkedin.com/company/arkanium-consulting',
  x: 'https://x.com/arkaniumconsulting',
  instagram: 'https://www.instagram.com/arkaniumconsulting',
  facebook: 'https://www.facebook.com/arkaniumconsulting',
  tiktok: 'https://www.tiktok.com/@arkaniumconsulting',
} as const;
