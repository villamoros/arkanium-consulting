# arkanium-app — `app.arkanium.consulting`

Aplicación para **clientes** de Arkanium. Cada cliente ve solo su tenant: proyectos, tareas, entregables y solicitudes de reunión.

**Estado:** carpeta creada. Sin código. Se construye en la fase 4 de ARK-CORE, con su contrato propio.

**Depende de:** el backend modular (tenancy e identidad de la fase 3) y la autenticación con Clerk (organizaciones B2B).

**No contiene:** lógica de negocio. Consume la API del backend. Los agentes de IA no viven aquí; trabajan desde `arkanium-control`.

Documentos de referencia: `arkanium-web/docs/ark-core-001-roadmap.md` y `arkanium-web/docs/ark-core-002-decisiones.md`.
