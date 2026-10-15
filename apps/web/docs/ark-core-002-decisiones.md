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

1. Responder Q1 a Q6.
2. Escribir el contrato de la fase 3 (identidad y tenancy), que incluye la verificación de RLS con Clerk.
3. Crear la estructura del backend modular en el repositorio que elijas (Q2).
