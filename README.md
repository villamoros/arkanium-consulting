# Arkanium — monorepo

Plataforma de Arkanium: sitio y blog, dashboards de clientes y del equipo, y orquestación de agentes de IA.

## Estructura

```text
apps/
  web/       Astro (estático). Historial de arkanium-web importado con git subtree. arkanium.consulting
  app/       Next.js. Dashboard de clientes. app.arkanium.consulting
  core/      Next.js. CRM y mini CMS del equipo. core.arkanium.consulting
  control/   Next.js. Orquestación de agentes y conocimiento. Privado
services/
  api/       Fastify (TypeScript). API de negocio. Consumida por las apps y por control
packages/
  contracts/ Esquemas zod compartidos entre la API y las apps
infra/       docker-compose, gateway y notas de despliegue en VM
docs/        Hoja de ruta y decisiones de ARK-CORE
```

## Comandos

Requisitos: Node 22.12 o superior y pnpm.

```bash
pnpm install
pnpm --filter @arkanium/api dev       # API en http://localhost:3000
pnpm --filter @arkanium/app dev       # app de clientes
pnpm --filter @arkanium/core dev      # core interno
pnpm --filter @arkanium/control dev   # control
pnpm --filter @arkanium/web dev       # sitio web
pnpm --filter @arkanium/api test      # pruebas de la API
```

## Reglas

- Las apps hablan solo con la API, nunca con la base de datos.
- Ningún secreto en el repositorio. `.env.example` solo lista nombres de variables.
- Las dependencias pasan la política de antigüedad mínima de pnpm. No se desactiva; si un paquete es muy reciente, se espera o se fija una versión anterior, y se anota el motivo.
- Decisiones de arquitectura en `docs/`.
