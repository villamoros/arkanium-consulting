/**
 * Estado del consentimiento de cookies. Lógica pura (sin DOM) para poder probarla con node.
 *
 * Una sola cookie first-party guarda la elección: `arkanium_consent`. Es estrictamente necesaria
 * (recuerda la decisión del visitante), por eso no requiere consentimiento previo.
 * Las categorías opcionales (analítica, marketing) están desactivadas: hoy el sitio no carga ningún
 * script de terceros. Cualquier script futuro debe preguntar `allows(category)` antes de cargarse.
 */

export const CONSENT_COOKIE = 'arkanium_consent';
/** 6 meses. Pasado ese plazo, el banner vuelve a aparecer. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;

export type OptionalCategory = 'analytics' | 'marketing';

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
}

export interface StoredConsent extends ConsentChoice {
  version: 1;
  savedAt: string;
}

/** Lee el JSON guardado en la cookie. Devuelve null si falta, está corrupto o es de otra versión. */
export function parseConsent(raw: string | undefined | null): StoredConsent | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredConsent>;
    if (data.version !== 1 || typeof data.analytics !== 'boolean' || typeof data.marketing !== 'boolean') return null;
    return { version: 1, analytics: data.analytics, marketing: data.marketing, savedAt: String(data.savedAt ?? '') };
  } catch {
    return null;
  }
}

export function serializeConsent(choice: ConsentChoice, now: Date): string {
  const stored: StoredConsent = { version: 1, analytics: choice.analytics, marketing: choice.marketing, savedAt: now.toISOString() };
  return JSON.stringify(stored);
}

/** Cadena completa para `document.cookie`. `secure` solo en https. */
export function consentCookie(choice: ConsentChoice, now: Date, secure: boolean): string {
  const value = encodeURIComponent(serializeConsent(choice, now));
  return `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** Busca la cookie de consentimiento en la cadena `document.cookie`. */
export function readConsentCookie(cookieHeader: string): StoredConsent | null {
  const match = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    return parseConsent(decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1)));
  } catch {
    return null;
  }
}

/** true si la categoría está permitida. Sin elección guardada, nada opcional está permitido. */
export function allows(consent: StoredConsent | null, category: OptionalCategory): boolean {
  return consent ? consent[category] === true : false;
}
