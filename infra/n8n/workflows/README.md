# Workflows de n8n

Automatizaciones externas de Arkanium. La API conserva el estado (reuniones, aprobaciones, actas); n8n solo ejecuta acciones hacia fuera (calendario, correo) cuando la API lo pide.

## Reglas

- **Un JSON por workflow**, con los nombres de nodo en español. Versión de n8n fijada en `infra/docker-compose.dev.yml` (`n8nio/n8n:2.43.7`); la misma versión debe usarse en el servidor.
- **Sin secretos en el JSON.** Las credenciales se referencian por nombre y se crean de nuevo en cada entorno (local y Hostinger).
- **Sin URLs fijas.** La API llama a los webhooks con `N8N_WEBHOOK_BASE_URL`, que cambia por entorno.
- **Ninguna acción con efecto externo sin aprobación previa.** Cada workflow se dispara solo cuando el owner ya tomó la decisión en core.

## Workflows

| Archivo | Ruta del webhook | Qué hace | Lo que responde |
|---|---|---|---|
| `reunion-confirmada.json` | `POST /webhook/reunion-confirmada` | Crea el evento en Google Calendar con enlace de Meet, invitados y recordatorio emergente de 60 min. | `{ ok, eventId, htmlLink, meetLink }` |
| `reunion-reprogramada.json` | `POST /webhook/reunion-reprogramada` | Actualiza el evento existente: hora, tema e invitados (la lista reemplaza a la anterior). | `{ ok, htmlLink }` |
| `reunion-cancelada.json` | `POST /webhook/reunion-cancelada` | Quita el evento del calendario y avisa a los invitados. | `{ ok }` |

Todos usan la credencial de Google `Google Calendar account` y la de cabecera `Arkanium webhook secret`.

### Payloads que envía la API

```json
// reunion-confirmada
{ "meetingId": "uuid", "topic": "Revisión del informe", "startsAt": "2026-12-01T15:00:00.000Z",
  "endsAt": "2026-12-01T16:00:00.000Z", "attendees": ["cliente@ejemplo.com"], "meet": true }

// reunion-reprogramada (siempre manda el conjunto completo: tema, horario e invitados)
{ "eventId": "id-del-evento", "startsAt": "...", "endsAt": "...", "topic": "...", "attendees": ["cliente@ejemplo.com"] }

// reunion-cancelada
{ "eventId": "id-del-evento" }
```

Todas las llamadas llevan la cabecera `X-Arkanium-Secret`. Sin ella, n8n responde 403.

## Importar y publicar

En n8n 2.x un workflow importado no queda activo: hay que **publicarlo**. Con n8n levantado (`docker compose -f infra/docker-compose.dev.yml up -d n8n`):

```bash
MSYS_NO_PATHCONV=1 docker exec arkanium-dev-n8n-1 n8n import:workflow --input=/workflows/reunion-confirmada.json
MSYS_NO_PATHCONV=1 docker exec arkanium-dev-n8n-1 n8n publish:workflow --id=arkReunionConf01
```

Repite con `reunion-reprogramada.json` (`arkReunionRepro01`) y `reunion-cancelada.json` (`arkReunionCancel01`). Después reinicia n8n para que registre los webhooks:

```bash
docker restart arkanium-dev-n8n-1
```

`MSYS_NO_PATHCONV=1` evita que Git Bash en Windows convierta `/workflows` en una ruta de Windows. Si el webhook responde 404 justo después de reiniciar, espera unos segundos: n8n tarda en registrarlos.

La primera vez, abre http://localhost:5678, crea la credencial de Google Calendar y asígnala a los nodos de calendario de los tres workflows.

## Comprobar

No hace falta curl. Con `services/api/.env.local` configurado:

```bash
pnpm --filter @arkanium/api smoke:calendar
```

Recorre confirmar, reprogramar, cancelar, la agenda y el caso de error, y muestra un PASA o FALLA por cada paso. Crea reuniones marcadas «PRUEBA smoke» y envía invitaciones de prueba a `SMOKE_INVITEE` (por defecto, el correo del owner).

## Protección del webhook

- El valor vive en `services/api/.env.local` como `N8N_WEBHOOK_SECRET`, y en la credencial de n8n `Arkanium webhook secret`. Nunca va en estos JSON ni en el chat.
- Cada entorno tiene su propio secreto. En Hostinger se genera uno nuevo y se configura en la API y en n8n.
- Si el secreto se filtra, cámbialo en los dos lugares y reimporta la credencial.
- Ese mismo secreto protege las rutas internas de recordatorios de la API. Separarlos es una decisión pendiente.

## Pendiente antes de producción

- **Credenciales de Google en el servidor.** Crear de nuevo `Google Calendar account` en Hostinger, con su cliente de OAuth o con la URI de producción añadida al cliente actual.
- **Recordatorios por correo.** Hoy el recordatorio es el aviso emergente de Google. La ruta `GET /internal/meetings/due-reminders` ya existe, pero ningún workflow la llama todavía.
- **Reintentos.** Si n8n no responde, la reunión queda confirmada con el calendario «pendiente», y se reintenta desde la reunión en core. No hay reintento automático.

## Exportar para el servidor

En n8n: menú del workflow → **Download**. Guarda el archivo en esta carpeta, reemplazando el anterior, y revisa que no contenga valores de credenciales antes de versionarlo.
