/**
 * Iconos de offerings por slug (activo de diseño, no contenido editorial).
 * Contenido interior del <svg viewBox="0 0 48 48">; constantes propias, no input del CMS.
 * Un offering sin icono usa DEFAULT_OFFERING_ICON.
 */
export const offeringIcons: Record<string, string> = {
  "technical-health-check": "<path d=\"M7 25h8l3-10 5 20 4-10h14\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "full-technology-diagnosis": "<circle cx=\"21\" cy=\"21\" r=\"10\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"m29 29 10 10M17 21h8M21 17v8\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"/>",
  "paid-discovery-sprint": "<circle cx=\"24\" cy=\"24\" r=\"14\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"m29 19-3 7-7 3 3-7 7-3Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"m26 26-4 4\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
  "architecture-assessment": "<rect x=\"9\" y=\"11\" width=\"12\" height=\"10\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/><rect x=\"27\" y=\"27\" width=\"12\" height=\"10\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M21 16h7m-4 0v11m0 0h3\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
  "solution-architecture-design": "<path d=\"M10 35h28M14 35V23h8v12m4 0V13h8v22\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M14 18h20\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
  "architecture-modernization-roadmap": "<path d=\"M9 34h30M13 28h10M13 20h18M13 12h26\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"m32 24 6 6-6 6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "technical-due-diligence": "<path d=\"M24 7 37 12v10c0 8-5.4 14-13 17-7.6-3-13-9-13-17V12l13-5Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"m18 24 4 4 8-9\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "governance-framework-design": "<rect x=\"9\" y=\"9\" width=\"12\" height=\"12\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/><rect x=\"27\" y=\"9\" width=\"12\" height=\"12\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/><rect x=\"18\" y=\"28\" width=\"12\" height=\"12\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M15 21v4m18-4v4m-18 3h18\" stroke=\"currentColor\" stroke-width=\"2\"/>",
  "governance-retainer": "<path d=\"M36 19a13 13 0 0 0-23-4M12 29a13 13 0 0 0 23 4\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"m12 15 1 7 7-1m16 12-1-7-7 1\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "architecture-review-board-as-a-service": "<path d=\"M24 10v28M13 16h22M13 16l-5 10h10l-5-10Zm22 0-5 10h10l-5-10ZM15 38h18\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "technical-risk-monitoring": "<path d=\"m24 8 17 30H7L24 8Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M24 19v9m0 5v.1\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"/>",
  "cto-advisory-light": "<path d=\"M16 28a11 11 0 1 1 16 0c-2 2-3 3-3 6H19c0-3-1-4-3-6Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M19 39h10M20 35h8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
  "fractional-architect": "<path d=\"M10 36h28M13 36V24l11-12 11 12v12M20 36v-8h8v8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/>",
  "fractional-cto-startup-tier": "<path d=\"M26 8c7 3 10 9 9 17l5 5-6 2-2 6-5-5c-8 1-14-2-17-9 4-8 9-13 17-16Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"28\" cy=\"20\" r=\"3\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"m13 35-4 5 7-2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
  "fractional-cto-growth-tier": "<path d=\"M10 36V12m0 24h28M16 30l7-7 5 4 10-12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M32 15h6v6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
  "embedded-technical-leadership": "<circle cx=\"18\" cy=\"18\" r=\"5\" stroke=\"currentColor\" stroke-width=\"2\"/><circle cx=\"32\" cy=\"19\" r=\"4\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M8 37c1-7 5-11 10-11s9 4 10 11M27 29c6 0 9 3 10 8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"
};

export const DEFAULT_OFFERING_ICON = offeringIcons['architecture-assessment'] as string;
