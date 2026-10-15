/**
 * Contenido del correo de lead (registro oficial) y de la alerta de Slack (aviso interno, datos mínimos).
 * Solo texto plano: nunca se inserta HTML con datos del visitante.
 */
import type { Lead } from './lead.ts';

const PRIORITY_LABEL: Record<string, string> = {
  strategy: 'Estrategia',
  product: 'Producto',
  architecture: 'Arquitectura',
  unsure: 'No estoy seguro',
};

export function leadEmail(lead: Lead): { subject: string; text: string } {
  const priority = PRIORITY_LABEL[lead.priority] ?? lead.priority;
  const lines = [
    `Nombre: ${lead.name}`,
    `Correo: ${lead.email}`,
    `Prioridad: ${priority}`,
    lead.service ? `Servicio: ${lead.service}` : null,
    lead.offering ? `Oferta: ${lead.offering}` : null,
    `Idioma de la página: ${lead.locale}`,
    `Recibido: ${lead.receivedAt}`,
    '',
    'Contexto:',
    lead.context || '(sin contexto)',
  ].filter((l): l is string => l !== null);
  return { subject: `[Lead] ${priority} — ${lead.name}`, text: lines.join('\n') };
}

/** Alerta interna: datos mínimos. El registro completo está en el correo. */
export function slackAlert(lead: Lead): string {
  const priority = PRIORITY_LABEL[lead.priority] ?? lead.priority;
  const snippet = lead.context.length > 200 ? `${lead.context.slice(0, 200)}…` : lead.context;
  return [
    `Nuevo lead (${lead.locale}): ${lead.name} — ${priority}`,
    `Correo: ${lead.email}`,
    snippet ? `Contexto: ${snippet}` : null,
  ].filter((l): l is string => l !== null).join('\n');
}
