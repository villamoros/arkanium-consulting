# ARK-INF-001 — infraestructura y orquestador

**Estado:** decisión de arquitectura, con puntos por confirmar. Complementa ARK-ARCH-001.
**Fecha:** 2026-10-15.

## 1. Decisión

La plataforma se separa en dos zonas:

| Zona | Qué contiene | Dónde corre |
| --- | --- | --- |
| **Plataforma** | Sitio (`arkanium-web`), app de clientes, core y API de negocio | Servidor VM con Docker, detrás de un gateway (Caddy o Traefik). |
| **Orquestación de agentes** | Control y el orquestador que coordina a los 42 agentes | Servidor separado y dedicado. |

**Motivo de la separación:** los agentes ejecutan tareas largas, consumen recursos de forma irregular y tienen un perímetro de seguridad distinto. Si corren en el mismo servidor que la plataforma de clientes, un fallo o un abuso de un agente afecta a los clientes. Separados, el daño queda contenido.

## 2. Orquestador: Hermes u OpenClaw

Hay dos candidatos. Aún no se ha elegido. Antes de decidir hay que verificar, con su documentación actual:

- qué modelo de ejecución usa cada uno (agentes persistentes o tareas por demanda);
- cómo se definen herramientas y permisos por agente;
- si permite aprobaciones humanas antes de una acción externa (requisito de ARK-ARCH-002);
- cómo registra la actividad y si esa bitácora se puede exportar a nuestra base;
- si se puede desplegar en un servidor propio y con qué requisitos.

Criterio de decisión: el que cumpla **aprobación humana obligatoria** y **bitácora exportable** con menos adaptación.

## 3. Servidor de agentes

- **Proveedor:** pendiente. Se mencionó Hostinger; antes de contratar hay que verificar que su oferta incluya el orquestador elegido y los requisitos de memoria y CPU que pida.
- **Aislamiento:** el servidor de agentes no tiene acceso directo a la base de datos de producción. Accede solo a través de la API de negocio, con credenciales de corta vida atadas a un proyecto (ARK-ARCH-003, regla 2).
- **Secretos:** las credenciales viven en el servidor de agentes, nunca en el repositorio.
- **Respaldo:** la bitácora se replica a la base de datos principal. El servidor de agentes no guarda registros que no existan también en la base.

## 4. Base de datos

- **Local (desarrollo):** PostgreSQL con Drizzle. Las pruebas usan una base embebida (PGlite) con las mismas migraciones.
- **Producción:** Supabase, PostgreSQL gestionado. El esquema usa SQL estándar para que sea portable.
- **Migraciones:** se generan desde el esquema (`services/api/drizzle/`) y se aplican con `pnpm db:migrate`.

## 5. Entornos

| Entorno | Propósito | Clerk | Base de datos |
| --- | --- | --- | --- |
| Desarrollo | Trabajo diario en tu equipo | Instancia de desarrollo | PostgreSQL local |
| Pruebas | Validar antes de producción | Instancia de desarrollo | Supabase de pruebas |
| Producción | Clientes reales | Instancia de producción | Supabase de producción |

Ningún secreto de producción se usa en desarrollo.

## 6. Pendientes

1. Elegir orquestador (Hermes u OpenClaw), con la verificación de la sección 2.
2. Elegir proveedor del servidor de agentes y verificar sus requisitos.
3. Elegir proveedor y región del servidor de la plataforma.
4. Crear el proyecto de Supabase de pruebas y el de producción.
5. Crear la instancia de producción de Clerk, con sus dominios reales.
