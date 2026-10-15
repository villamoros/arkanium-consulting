# infra — despliegue

Contenedores Docker en un servidor VM. Un API Gateway (Caddy o Traefik) es la única entrada pública: termina TLS y enruta por host.

| Host | Servicio | Acceso |
| --- | --- | --- |
| `arkanium.consulting` | web (estático) | Público. Por confirmar: Cloudflare Pages o contenedor. |
| `app.arkanium.consulting` | `apps/app` (Next.js) | Clientes |
| `core.arkanium.consulting` | `apps/core` (Next.js) | Equipo Arkanium |
| privado | `apps/control` (Next.js) + worker | Solo el owner (acceso restringido) |
| `arkanium.consulting/api/*` | `services/api` (Fastify) | Solo a través del gateway |

Reglas:
- Ningún secreto en el repositorio. Solo nombres de variables en `.env.example`.
- La base de datos de producción es Supabase; el VM no guarda datos y puede reemplazarse.
- Las apps frontend hablan solo con la API.

Pendiente: proveedor y región del VM (fase 3), gateway elegido y configuración de producción.
