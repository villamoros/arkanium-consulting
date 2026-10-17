/**
 * Calendario vía n8n (ver infra/n8n/workflows). La API llama a un webhook por acción:
 * crear, reprogramar o cancelar. n8n habla con Google Calendar; la API no guarda credenciales de Google.
 * Cada llamada lleva el secreto en la cabecera X-Arkanium-Secret y tiene un tiempo máximo.
 */
export interface CalendarEventRequest {
  meetingId: string;
  topic: string;
  startsAt: string;
  endsAt: string;
  /** Todos los invitados: el contacto principal o el lead, más los que añadió el owner. */
  attendees: string[];
  /** Crear enlace de videollamada (Google Meet). */
  meet: boolean;
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
  meetLink: string | null;
}

export interface CalendarEventUpdate {
  eventId: string;
  startsAt: string;
  endsAt: string;
  topic: string;
  /** Lista completa de invitados. Debe tener al menos uno: un evento sin invitados no se actualiza. */
  attendees: string[];
}

export interface CalendarGateway {
  createEvent(input: CalendarEventRequest): Promise<CalendarEventResult>;
  /** Actualiza un evento existente. Envía siempre tema, horario e invitados completos: el workflow los reemplaza. */
  updateEvent(input: CalendarEventUpdate): Promise<{ htmlLink: string }>;
  cancelEvent(eventId: string): Promise<void>;
}

/** Fallo al hablar con n8n o respuesta que no se puede usar. El mensaje es apto para el owner. */
export class CalendarSyncError extends Error {}

const PATHS = {
  create: '/reunion-confirmada',
  update: '/reunion-reprogramada',
  cancel: '/reunion-cancelada',
} as const;

export function createN8nCalendar(options: { baseUrl: string; secret: string; fetchImpl?: typeof fetch; timeoutMs?: number }): CalendarGateway {
  const { secret, fetchImpl = fetch, timeoutMs = 10_000 } = options;
  const base = options.baseUrl.replace(/\/+$/, '');

  async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Arkanium-Secret': secret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new CalendarSyncError('n8n no respondió.');
    }
    if (!response.ok) throw new CalendarSyncError(`n8n respondió ${response.status}.`);
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) throw new CalendarSyncError('n8n no devolvió una respuesta válida.');
    return data;
  }

  return {
    async createEvent(input) {
      const data = await post(PATHS.create, input);
      if (typeof data.eventId !== 'string') throw new CalendarSyncError('n8n no devolvió el evento.');
      return {
        eventId: data.eventId,
        htmlLink: typeof data.htmlLink === 'string' ? data.htmlLink : '',
        meetLink: typeof data.meetLink === 'string' && data.meetLink ? data.meetLink : null,
      };
    },
    async updateEvent(input) {
      const data = await post(PATHS.update, input);
      return { htmlLink: typeof data.htmlLink === 'string' ? data.htmlLink : '' };
    },
    async cancelEvent(eventId) {
      await post(PATHS.cancel, { eventId });
    },
  };
}
