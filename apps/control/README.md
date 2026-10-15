# arkanium-control — orquestación de agentes de IA

Aplicación donde se definen, orquestan y auditan los **agentes de IA** que trabajan para `app` y `core`. Separada de la lógica de negocio a propósito.

**Estado:** carpeta creada. Sin código. Se construye en la fase 6 de ARK-CORE, con su contrato propio.

**Contiene (previsto):**
- Definición de agentes y de sus herramientas permitidas.
- Gestión de conocimiento: el manual de cada caso, por tenant.
- Colas de aprobación humana y bitácora de cada ejecución.

**No contiene:** tablas de negocio. Los agentes actúan a través de la API del backend, con credenciales acotadas a un tenant.

**Subdominio:** pendiente de decidir. No está en la lista de subdominios confirmada (`arkanium.consulting`, `app.`, `core.`). Ver `arkanium-web/docs/ark-core-002-decisiones.md`.
