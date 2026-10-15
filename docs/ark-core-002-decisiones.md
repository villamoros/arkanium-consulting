# ARK-CORE — decisiones confirmadas y preguntas abiertas

**Estado:** registro de decisiones. Reemplaza a `ark-core-001-roadmap.md` en las decisiones D1 a D6. El resto del roadmap sigue vigente.
**Fecha:** 2026-10-15.

---

## 1. Mapa de aplicaciones y dominios

| Carpeta | Dominio | Quién la usa | Qué hace |
| --- | --- | --- | --- |
| `arkanium-web` | `arkanium.consulting` | Público | Sitio y blog. Astro estático. Ya terminado. |
| `arkanium-app` | `app.arkanium.consulting` | Clientes | Proyectos, tareas, entregables y reuniones de cada cliente. |
| `arkanium-core` | `core.arkanium.consulting` | Equipo Arkanium | CRM y mini CMS. |
| `arkanium-control` | Por decidir | Owner (y agentes) | Orquestación de agentes, gestión de conocimiento y aprobaciones. |

Dominio único: `arkanium.consulting`. No se usan otros dominios ni subdominios para el sistema.

**Nota de nombres:** en el roadmap 001 llamé «control» al dashboard del owner. Ahora ese dashboard es `arkanium-core`, y `arkanium-control` es la capa de agentes. Los dos documentos usan la nomenclatura de este registro.

## 2. Decisiones confirmadas

| # | Decisión | Detalle confirmado por el owner | Implicaciones |
| --- | --- | --- | --- |
| D1 | Clerk en modo **B2B** con multi-tenancy | Clerk ya está preconfigurado en modo B2B. Un cliente es una organización. | Clerk identifica usuarios y organizaciones. El modelo de dominio (tenants, membresías, permisos) vive en nuestra base y se sincroniza con Clerk. Ver §3.1. |
| D2 | Base compartida con `tenant_id` y RLS | Confirmado. | Ver §3.2 sobre cómo se valida el tenant con Clerk. |
| D3 | TypeScript / Node | Confirmado. | Mismo lenguaje que el sitio. |
| D4 | Infraestructura | «Sí vamos a usar todo esto». Falta asignar cada servicio a un proveedor. | Ver §4. |
| D5 | PostgreSQL local; Supabase en producción | Local en desarrollo, Supabase en producción. | Ver §3.2: el esquema debe ser SQL estándar. |
| D6 | Cuatro aplicaciones | Web, app, core y control. Control separado para aislar agentes, lógica de negocio y gestión de conocimiento. | Ver §5: la separación se sostiene con una API común, no con acceso directo a datos. |

Mini CMS y CRM: quedan en `arkanium-core`, según tu indicación.

## 3. Implicaciones técnicas

### 3.1 Clerk B2B y niveles de tenant

Tu modelo tiene **dos niveles**, y conviene separarlos desde ahora:

- **Organización (cliente).** Es la organización de Clerk. Agrupa a todas las personas de un cliente y es la frontera de aislamiento principal.
- **Engagement (servicio contratado).** Cada servicio que compra un cliente abre un espacio propio con su equipo de agentes y su manual de caso. Esto **no es un concepto de Clerk**: es nuestro. Vive dentro de la organización como entidad propia.

Consecuencia: un cliente con dos servicios tiene una organización y dos engagements. Las personas del cliente pueden tener acceso a uno, a los dos o a ninguno, según permisos del engagement.

### 3.2 PostgreSQL local, Supabase en producción, y RLS

- Supabase es PostgreSQL. Para que local y producción se comporten igual, **el esquema y las políticas RLS se escriben en SQL estándar**, sin depender de funciones exclusivas de Supabase (por ejemplo, su sistema de autenticación integrado).
- La identidad viene de Clerk, no de Supabase Auth. Hay que confirmar cómo pasar el tenant del usuario autenticado a Postgres para que RLS lo lea. Creo que Supabase admite proveedores de identidad externos, pero **no lo he verificado**: lo confirmaré con su documentación antes de escribir el contrato de la fase 3.

### 3.3 Qué no está resuelto y por qué importa

- **Secretos:** la clave de Supabase de servicio salta RLS. Solo puede vivir en el backend, nunca en las apps ni en control.
- **Migraciones:** una sola herramienta de migraciones para local y producción.

## 4. Infraestructura (D4), propuesta

| Pieza | Propuesta | Por qué |
| --- | --- | --- |
| `arkanium-web` | Cloudflare Pages (ya en uso) | Estático. Sin cambios. |
| `arkanium-app`, `arkanium-core` | Cloudflare Pages | Son SPA. Mismo proveedor que el sitio. |
| Backend modular (API de negocio) | Servicio Node (contenedor) | Las tareas de agentes son largas y necesitan colas; los Workers tienen límites de tiempo de ejecución. |
| `arkanium-control` (orquestación) | Servicio Node (contenedor) | Mismo motivo. |
| Base de datos | Local: PostgreSQL. Producción: Supabase. | Confirmado (D5). |
| Autenticación | Clerk | Confirmado (D1). |

**Pregunta:** ¿estás de acuerdo con que backend y control vivan en Node y no en Workers? Es mi recomendación, pero el proveedor concreto del servicio Node queda por decidir.

## 5. Opinión sobre D6 (cuatro aplicaciones)

**Estoy de acuerdo con el principio.** Separar los agentes del negocio y tratar el conocimiento como capa propia es el diseño correcto. Pero hay tres condiciones para que la separación sea real:

1. **Control no lee la base de datos directamente.** Los agentes actúan a través de la misma API del backend que usan las demás apps, con credenciales de corta vida acotadas a un tenant y un engagement. Si control lee tablas de negocio, la separación es solo visual.
2. **El manual de un caso no se reutiliza entre clientes.** Cada manual pertenece al engagement de un cliente. Lo que puede compartirse entre casos es el marco genérico (Arkanium Framework) y patrones anonimizados, y eso lo decides tú caso por caso. Conviene fijar esta regla ahora, porque es la que protege la confidencialidad de cada cliente.
3. **Hay cinco despliegues, no cuatro.** Contando el backend, son web, app, core, control y API. Para una sola persona operando la plataforma, eso es costo real de mantenimiento. Mi propuesta: el backend es un solo servicio (monolito modular), y las apps frontend pueden compartir un repositorio si prefieres menos frentes abiertos.

## 6. Preguntas abiertas

| # | Pregunta | Mi recomendación |
| --- | --- | --- |
| Q1 | ¿`arkanium-control` tendrá subdominio? | Sin subdominio público. Acceso solo para ti, con control de acceso del proveedor (p. ej. Cloudflare Access). |
| Q2 | ¿Un repositorio por aplicación o un monorepo? | Un monorepo con las apps frontend y el backend. Menos fricción para un equipo pequeño. |
| Q3 | ¿Cómo publica el mini CMS de `core` hacia el sitio estático? | `core` guarda el contenido en la base; el sitio se reconstruye al publicar (un disparador de build). Confirma si te parece. |
| Q4 | ¿Los clientes ven el manual de su caso o solo sus resultados? | Solo resultados en la app; el manual es interno y tú lo apruebas. Decide tú. |
| Q5 | ¿Los agentes pueden hablar con el cliente sin tu aprobación? | No. Igual que las reuniones: toda salida hacia el cliente pasa por aprobación. |
| Q6 | ¿Proveedor concreto para los servicios Node? | Lo elegimos antes de la fase 3, con costo y región. |

## 7. Pendientes que siguen abiertos

Confirmado por el owner, sin cambios:
- **Botón de inicio de sesión (`/login/`):** se queda como está hasta conectar Clerk.
- **Formulario de contacto:** en stand-by. Se activa al final, justo antes del deploy.
- **Cifras del hero (97.8% y «0 playbooks genéricos»):** se quedan hasta que la plataforma genere datos reales.

Pendientes que no dependen de nadie:
- **Sufijo de título:** los títulos terminan en «Arkanium Consulting LLC, New Mexico - USA». La prueba `test:seo` espera «Arkanium Consulting». Hay que decidir cuál es el sufijo oficial y ajustar código o prueba.
- **Dominio por defecto:** corregido a `arkanium.consulting` en el código, pendiente de commit.

## 8. Siguiente paso

1. Confirmar el stack de la API (§10.2) y el proveedor del servidor VM (§10.4).
2. Escribir el contrato de la fase 3 (identidad y tenancy), que incluye la verificación de RLS con Clerk.
3. Crear el monorepo y los servicios según §10.3.

## 9. Respuestas del owner (2026-10-15)

| # | Respuesta | Efecto |
| --- | --- | --- |
| Q1 | `arkanium-control` privado, solo para el owner. | Sin subdominio público. Acceso restringido por el proveedor (p. ej. Cloudflare Access). |
| Q2 | Monorepo. | Un repositorio para apps, API y paquetes compartidos. Ver §10.3. |
| Q3 | El contenido se guarda en la base y el sitio se reconstruye al publicar. | `arkanium-web` seguirá estático. El build leerá el contenido publicado. |
| Q4 | Los clientes ven solo resultados. El manual es propiedad intelectual de Arkanium. | El manual vive solo en `arkanium-control`. Ninguna API pública ni la app del cliente lo expone. |
| Q5 | Los agentes no escriben al cliente. Trabajan internamente y reportan resultados al dashboard del cliente y al owner. | Un resultado que llega a `arkanium-app` es una salida externa. Recomiendo que cada resultado pase por tu revisión mientras no confíes en el flujo. |
| Q6 | Contenedores Docker en un servidor VM, con endpoints y arquitectura de API Gateway. | Ver §10.1. |

## 10. Stack y arquitectura de servicios (propuesta, por confirmar)

### 10.1 Piezas

```text
Navegador
  → Gateway (Caddy o Traefik, en el VM): TLS, enrutamiento por host, límites de tasa
      → app.arkanium.consulting   → arkanium-app   (Next.js, contenedor)
      → core.arkanium.consulting  → arkanium-core  (Next.js, contenedor)
      → /api/*                    → API            (servicio Node, contenedor)
      → control (privado)         → arkanium-control (Next.js + worker, contenedor)

API → Supabase (PostgreSQL en producción; PostgreSQL local en desarrollo)
arkanium-control → API (credenciales acotadas a tenant y engagement)
arkanium-web (estático): por confirmar si sigue en Cloudflare Pages o pasa al VM.
```

Reglas:
- Las apps frontend hablan **solo con la API**, nunca con Supabase directamente. Así las reglas de negocio y de tenant viven en un único lugar.
- La API valida el token de Clerk y fija el tenant en cada transacción de Postgres, para que RLS lo aplique.
- `arkanium-control` nunca lee tablas de negocio: usa la API. Su propio conocimiento (manuales y ejecuciones) vive en un esquema separado.

### 10.2 ¿Hay que crear una API? Sí.

Motivos:
1. Las tres apps necesitan las mismas reglas de tenant y permisos. Sin API, cada app las duplicaría.
2. Control no puede tocar la base directamente (condición 1 del §5). La API es la única puerta.
3. Pediste una arquitectura de API Gateway: la API es el servicio detrás del gateway.
4. Más adelante llegarán el webhook del formulario de contacto y el disparador de publicación del sitio. Esos también pasan por la API.

**Opciones para el servicio:**

| Opción | A favor | En contra |
| --- | --- | --- |
| **Fastify (TypeScript)** — recomendado | Ligero y rápido. Validación de esquemas (zod o TypeBox). Genera OpenAPI. Los módulos de DDD se organizan como plugins. Mismo lenguaje que las apps. | Menos «opinionado» que NestJS: la disciplina de módulos la ponemos nosotros. |
| NestJS (TypeScript) | Módulos e inyección de dependencias de fábrica. Encaja con DDD. | Más código de andamiaje. Curva mayor. |
| Route handlers de Next.js | Un servicio menos. | La API queda acoplada al ciclo de despliegue de las apps. Con tres apps, la lógica se repite o se mezcla con la UI. No recomendado con gateway. |
| RoR (Ruby) | Convenciones maduras, migraciones y ORM muy productivos. | Segundo lenguaje, rompe D3. SDK de Clerk y Supabase para Ruby menos oficiales. Ecosistema de agentes más pobre. |
| FastAPI (Python) | Mejor ecosistema para IA, embeddings y evaluación de modelos. | Segundo lenguaje. Tipos separados de las apps (se reducen con OpenAPI). |

**Recomendación:** Fastify en TypeScript. Confirma D3 (TypeScript/Node) y evita dos lenguajes en el equipo. Los agentes se construyen con el SDK de Anthropic para TypeScript. Solo consideraría Python si aparece una necesidad concreta de ML pesado, y en ese caso sería un worker aparte, no la API.

Sobre RoR: si tú o alguien del equipo lo dominan, es una opción sólida para el CRUD. Lo descarto porque obliga a un segundo lenguaje y las integraciones con Clerk y Supabase son menos directas.

### 10.3 Monorepo (Q2)

```text
arkanium/                  (raíz del monorepo, pnpm workspaces)
├─ apps/
│  ├─ web/                 Astro (historial de arkanium-web, importado con git subtree)
│  ├─ app/                 Next.js  — app.arkanium.consulting
│  ├─ core/                Next.js  — core.arkanium.consulting
│  └─ control/             Next.js  — privado
├─ services/
│  └─ api/                 Fastify  — API de negocio
├─ packages/
│  ├─ contracts/           esquemas compartidos (zod): mismas formas en API y frontends
│  └─ config/              tsconfig y lint compartidos
└─ infra/                  Docker Compose, gateway, despliegue en VM
```

Dos decisiones que quedan dentro de esto:
- **Raíz del repositorio.** El historial de `arkanium-web` está en su propio repositorio. Propongo crear el monorepo como raíz nueva e importar ese historial con `git subtree`, para no perderlo.
- **Esquema de control.** Propongo que `arkanium-control` tenga su propio esquema en la misma base Postgres, con acceso solo desde su worker.

### 10.4 Servidor VM (Q6)

El proveedor del VM todavía no está elegido. Depende de la región: si los clientes están en Latinoamérica, conviene una región cercana a Supabase. Propongo elegirlo al escribir el contrato de la fase 3, junto con la región de Supabase.

Un solo VM es un punto único de falla. Como la base de producción está en Supabase, el VM no guarda datos y puede reemplazarse sin perder información.

### 10.5 Next.js y Clerk

- Las tres apps usan Next.js con App Router y TypeScript.
- La protección de rutas con Clerk va en el middleware de Next.js.
- La verificación de permisos real siempre está en la API, no en el middleware.

## 11. Monorepo creado (2026-10-15)

Confirmado por el owner:
- **API:** Fastify con TypeScript (§10.2). Servicio aislado en `services/api`, con `GET /health` y pruebas con Vitest.
- **Monorepo:** `apps/` (web, app, core, control), `services/`, `packages/`, `infra/` (§10.3).
- **Next.js** en las tres apps, con TypeScript y App Router.

Registrado durante la creación:
- **Next.js fijado en 16.3.8** en las tres apps. La versión 16.4.1 se publicó el 14 de octubre, dentro del periodo de antigüedad mínima que aplica pnpm; el lockfile la rechazó. No se añadieron excepciones.
- **TypeScript 5.9** y **@types/node 22** en todos los paquetes. TypeScript 7 y @types/node 26 no coinciden con el resto del stack ni con la imagen Node 22.
- **Vite** declarado en `apps/web`: lo importa `astro.config.mjs` y pnpm no lo resuelve de forma implícita.
- **Build de scripts nativos permitido por nombre** (`esbuild`, `unrs-resolver`) en `pnpm-workspace.yaml`.

Verificado:
- API: pruebas pasan (2 de 2). Despliegue de producción con `pnpm deploy`: arranca con Node y `/health` responde el contrato.
- Next.js: `build` pasa en app, core y control.
- Web (Astro): `build` pasa.
- Imagen Docker: **no verificada**. Docker Desktop no estaba en ejecución en este equipo.

Pendiente:
- Proveedor y región del VM (fase 3).
- Commit del monorepo y decisión sobre `arkanium-web`: su copia de `docs/ark-core-002` quedó sin commit en ese repositorio.
