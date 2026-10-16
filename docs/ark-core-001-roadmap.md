# ARK-CORE — hoja de ruta (borrador)

**Estado:** borrador de planificación. No es contrato: no autoriza implementación. Los contratos por fase llegan después y son los que mandan.
**Actualización:** las decisiones D1 a D6 están respondidas en [ark-core-002-decisiones.md](ark-core-002-decisiones.md). Dominio y subdominios: `arkanium.consulting`, `app.` y `core.`. El dashboard del owner es `arkanium-core`; `arkanium-control` es la capa de agentes.
**Fecha:** 2026-10-15.
**Alcance:** fases 3 a 6 del proyecto. ARK-CORE es la plataforma con autenticación, dashboard de clientes, dashboard de administración y orquestación de agentes de IA.
**Fuera de alcance de este documento:** el sitio web y el blog. Son estáticos, están cerrados como fase y viven en su propio despliegue.

---

## 1. Principios

1. **Separación de despliegues.** El sitio y el blog (Astro, estático) no cambian por ARK-CORE. ARK-CORE es otra aplicación en otro despliegue. La única unión es la API de captación (el formulario de contacto ya entrega leads; ARK-CORE los consumirá más adelante).
2. **Monolito modular con DDD.** Un solo backend desplegable, dividido en módulos con fronteras de dominio explícitas. Cada módulo es dueño de sus datos y solo se comunica con otros a través de su interfaz pública o de eventos de dominio. Ningún módulo lee tablas de otro.
3. **La autorización se decide en el servidor.** Nunca por un parámetro de URL ni por un rol enviado desde el navegador. Esto ya está escrito en la documentación de auth (ver `ark-blog-001-v2-architecture-assessment.md`, §7).
4. **Los agentes no actúan solos en lo que compromete al negocio.** Cualquier acción con efecto externo (agendar, enviar un correo a un cliente, cambiar un estado comercial) pasa por aprobación humana. Es la regla que ya rige las reuniones.
5. **TaskView es referencia, no base.** [TaskView Community](https://github.com/Gimanh/taskview-community) es una plataforma de gestión de proyectos autoalojada. Sirve como modelo de funciones y de organización. No se copia código sin revisar su licencia (el propio README la describe como *source-available*).

## 2. Lo que tomamos de la referencia

| Idea de TaskView | Cómo la adaptamos |
| --- | --- |
| Organizaciones con miembros y proyectos propios (multi-tenant) | Un **tenant** por cliente de Arkanium. Sus proyectos, tareas y documentos quedan aislados. |
| Roles y permisos granulares, acceso restringido por proyecto | Roles por tenant (cliente, miembro del equipo cliente, administrador de Arkanium). Permisos por proyecto. |
| Tableros, listas, tareas con subtareas, prioridades y fechas límite | Vista de tareas del cliente con estado, responsable y fecha. Es el núcleo del dashboard de clientes. |
| Panel de analítica y reportes de carga de trabajo | Panel de administración: pipeline de leads, clientes activos y carga del equipo. |
| Servidor MCP para que un asistente opere sobre proyectos | Base conceptual para la fase de agentes: las herramientas expuestas al agente serán acciones de dominio con permisos y aprobación, no acceso libre a la base de datos. |
| Tokens de API con permisos acotados | Credenciales para integraciones y agentes, con alcance mínimo y revocables. |

No tomamos: el módulo financiero (ingresos y gastos), la autenticación propia con SAML/SCIM (la autenticación será Clerk) y el despliegue con Docker Compose como decisión cerrada (queda abierto, ver §7).

## 3. Contextos delimitados (bounded contexts)

| Contexto | Responsabilidad | Dueño de datos |
| --- | --- | --- |
| **Identidad y acceso** | Inicio de sesión con Clerk, sesión entre subdominios, resolución de identidad verificada. | Identidad externa (Clerk); referencias locales. |
| **Tenancy** | Organizaciones cliente, membresías, roles y permisos. | Tenants, membresías, roles. |
| **Captación y pipeline** | Leads del formulario, oportunidades, propuestas, paso a cliente. | Leads, oportunidades. |
| **Proyectos del cliente** | Proyectos, tareas, entregables y documentos visibles para el cliente. | Proyectos, tareas, documentos. |
| **Agenda** | Solicitudes de reunión, aprobación del owner, sincronización con Google Calendar. | Solicitudes, aprobaciones. |
| **Orquestación de agentes** | Definición de agentes, herramientas permitidas, colas de aprobación, bitácora de acciones. | Agentes, ejecuciones, auditoría. |

Relaciones clave:
- Captación → Tenancy: al convertir un lead en cliente se crea el tenant. Es un evento de dominio, no una llamada directa a tablas.
- Orquestación → todos: los agentes solo usan **herramientas** publicadas por cada contexto. Nunca leen ni escriben tablas ajenas.

## 4. Fases

Las fases son secuenciales en su base. Las dos de dashboard pueden avanzar en paralelo una vez cerrado el modelo de tenancy.

### Fase 3 — Clerk multi-tenant (identidad y tenancy)

**Objetivo:** un visitante puede iniciar sesión, pertenece a uno o más tenants y el servidor sabe, con certeza, qué puede ver.

**Incluye:**
- Integración de Clerk (inicio de sesión, cierre, sesión compartida entre subdominios).
- Modelo de tenant, membresía y roles. Sincronización de usuarios de Clerk con el modelo local.
- Mapeo de la ruta `/login/` del sitio web al flujo real (hoy es un placeholder).
- Pruebas de autorización: un usuario de un tenant no lee datos de otro.

**Excluye:** contenido de los dashboards, agentes, pagos.

**Criterios de salida:** pruebas de aislamiento entre tenants pasan; ningún endpoint decide permisos con datos del cliente; el placeholder de `/login/` se reemplaza.

### Fase 4 — Dashboard para clientes

**Objetivo:** un cliente ve sus proyectos, el estado de sus tareas, sus entregables y sus reuniones, y puede pedir una reunión.

**Incluye (propuesta de MVP):**
- Lista de proyectos del tenant y detalle con tareas (estado, responsable, fecha límite).
- Documentos y entregables compartidos por Arkanium.
- Solicitud de reunión (queda pendiente de aprobación del owner; no se agenda sola).
- Notificaciones básicas por correo.

**Excluye:** facturación, edición de contenido por el cliente, comentarios en tiempo real.

**Criterios de salida:** un cliente solo ve lo de su tenant; las solicitudes de reunión llegan al owner; las pruebas de permisos cubren cada endpoint.

### Fase 5 — Dashboard para el administrador (owner)

**Objetivo:** el owner gestiona leads, clientes, reuniones y el equipo desde un solo lugar.

**Incluye (propuesta de MVP):**
- Bandeja de leads del formulario, con prioridad y estado.
- Conversión de lead a cliente (crea el tenant).
- Cola de aprobación de reuniones (aprobar, rechazar, proponer otra hora).
- Vista de clientes y de proyectos por cliente.
- Gestión del contenido de Insights (mini CMS). Hoy se hace por archivos; aquí se decide si se traslada.

**Excluye:** analítica avanzada, multiusuario de Arkanium con roles distintos al owner (queda para después).

**Criterios de salida:** un lead llega y se puede convertir en cliente sin tocar la base de datos; ninguna reunión se agenda sin aprobación explícita.

### Fase 6 — Orquestación de agentes de IA

**Objetivo:** agentes que interactúan con los dos dashboards para tareas repetitivas, bajo reglas de aprobación.

**Incluye (propuesta inicial, a validar):**
- Agente de captación: clasifica leads y redacta respuestas borrador para aprobación humana.
- Agente de agenda: propone horarios a partir de la disponibilidad, pero la reunión la aprueba el owner.
- Agente de seguimiento: resume el estado de proyectos del cliente y propone próximos pasos.
- Capa de herramientas: cada acción es una herramienta con permisos, alcance por tenant y registro de auditoría.
- Bitácora: cada ejecución queda registrada con entrada, herramientas usadas, aprobaciones y resultado.

**Excluye:** agentes que envían mensajes a clientes sin aprobación; acceso directo a la base de datos; elección de proveedor de IA (es otra fase, ver §7).

**Criterios de salida:** toda acción con efecto externo tiene aprobación registrada; un agente no puede usar una herramienta fuera de su tenant ni de sus permisos; la bitácora permite reconstruir cualquier ejecución.

## 5. Arquitectura propuesta (monolito modular)

```text
ARK-CORE (un despliegue backend, módulos con fronteras)
├─ identity/        Clerk, sesión, identidad verificada
├─ tenancy/         tenants, membresías, roles, permisos
├─ pipeline/        leads, oportunidades, conversión a cliente
├─ proyectos/        proyectos, tareas, entregables y reuniones del cliente
├─ scheduling/      solicitudes de reunión, aprobación, Google Calendar
├─ agents/          definiciones, herramientas, aprobaciones, bitácora
└─ shared-kernel/   tipos comunes, eventos de dominio, utilidades (sin lógica de negocio)

Frontend: dashboard cliente (app.) y dashboard owner (control.)
Sitio web + blog: Astro estático, sin cambios; consume solo la API pública de captación.
```

Reglas de la modularidad:
- Cada módulo expone una **interfaz pública** (funciones o servicios). Lo demás es privado.
- Comunicación entre módulos: llamadas a la interfaz pública o eventos de dominio. Prohibido el acceso directo a tablas ajenas.
- Un módulo no importa código interno de otro. Esto se verifica con reglas de lint o de dependencias, no solo por convención.
- Cada módulo tiene sus pruebas de dominio, sin depender de la base de datos cuando sea posible.

**Aislamiento multi-tenant (propuesta):** base de datos compartida con `tenant_id` en cada fila y políticas de seguridad a nivel de fila en Postgres. Es la opción más simple de operar. La alternativa (una base por tenant) se deja para cuando haya requisitos de aislamiento contractual.

**Subdominios y sesión:** `arkanium.consulting` (web), `app.arkanium.consulting` (clientes) y `control.arkanium.consulting` (owner). La sesión debe compartirse entre ellos y probarse. Un inicio de sesión no concede acceso a ambos dashboards por defecto: lo decide la membresía verificada.

## 6. Riesgos

| Riesgo | Impacto | Mitigación propuesta |
| --- | --- | --- |
| Fuga de datos entre tenants | Muy alto | Pruebas de aislamiento obligatorias por endpoint; políticas a nivel de fila; revisión de cada contrato de fase. |
| Autorización decidida en el cliente | Muy alto | Permisos solo en el servidor; el rol se resuelve desde la membresía verificada. |
| Agente con efecto externo sin aprobación | Alto | Aprobación explícita como regla de diseño, no como opción; bitácora de cada acción. |
| Desviación del monolito modular (acoplamiento) | Medio | Reglas de dependencias entre módulos verificadas en CI desde la fase 3. |
| Costo y control de proveedores de IA | Medio | Proveedor de IA como fase propia; límites de uso por agente. |
| Licencia de TaskView | Medio | No reutilizar código sin revisar la licencia; usar solo como referencia de funciones. |
| Dos dashboards en un solo sistema de sesión | Medio | Prueba de sesión entre subdominios antes de iniciar la fase 4. |

## 7. Decisiones abiertas (para tus contratos)

| # | Decisión | Opciones | Mi recomendación |
| --- | --- | --- | --- |
| D1 | ¿Usamos las organizaciones de Clerk como tenants? | a) Organizaciones de Clerk; b) tenancy propia sincronizada con Clerk | (b): el modelo de dominio queda en nuestra base y Clerk solo identifica. |
| D2 | Estrategia multi-tenant | a) tenant_id + RLS en base compartida; b) base por tenant | (a) mientras no haya requisito contractual de aislamiento físico. |
| D3 | Stack del backend | a) TypeScript/Node (coherente con Astro); b) otro | (a): mismo lenguaje que el sitio y la referencia. |
| D4 | Hosting del backend | a) Cloudflare Workers; b) servidor Node en un proveedor; c) Pages Functions | Depende de D5 y de la base de datos. Hay que decidirlo antes de la fase 3. |
| D5 | Base de datos | a) Postgres gestionado; b) otra | (a): la referencia usa Postgres y RLS es un mecanismo maduro. |
| D6 | ¿Uno o dos frontends? | a) Dos aplicaciones (app., control.); b) una aplicación con dos entradas | (a): separa permisos y despliegues. |
| D7 | Alcance real del MVP de cliente | ver fase 4 | Confirmar la lista de la fase 4. |
| D8 | ¿El mini CMS de Insights entra en fase 5? | sí / después | Después: primero el pipeline y la agenda. |
| D9 | Primer agente a construir | captación, agenda o seguimiento | Captación: es el flujo que ya existe con el formulario. |
| D10 | Proveedor de IA | por definir (el owner lo dejó como fase posterior) | Se decide en la fase 6 con costo y datos en mente. |
| D11 | Retención de datos del cliente y de leads | plazo | Va junto con B5 del contrato de captación. |

## 8. Pendientes heredados antes de cerrar la fase web

Antes de dar por cerrada la fase web, estos puntos siguen abiertos. Ninguno bloquea ARK-CORE, pero sí el sitio en producción:

1. **Dominio:** el build usa `arkaniumconsulting.com` por defecto, mientras el proyecto usa `arkanium.consulting`. Afecta canonical, sitemap y robots. Hay que fijar `PUBLIC_SITE_URL` en Cloudflare y corregir el valor por defecto. `test:seo` falla por este motivo.
2. **Inicio de sesión:** el botón lleva a `/login/`, que devuelve 404 en todas las páginas. Se oculta o se apunta a una página provisional hasta que exista Clerk (fase 3).
3. **Contenido sin confirmar en git:** los casos de estudio y los artículos del blog en los cuatro idiomas siguen sin commit.
4. **Cifras del hero** (97.8% y «0 playbooks genéricos»): sin respaldo. Recomiendo quitarlas antes de publicar.
5. **Protección del formulario:** falta límite de envíos (Cloudflare Rate Limiting o Turnstile) y la configuración de Resend y Slack (B2 y B3 del contrato de captación).

## 9. Próximo paso

Escribir un contrato por fase (3 a 6) con: problema, decisiones tomadas, alcance, excluido, criterios de aceptación y pruebas. Empezar por las decisiones D1 a D6, porque bloquean la fase 3.
