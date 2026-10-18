# ARK-DEV-001 — Metodología de desarrollo de CORE

**Estado:** vigente. Define cómo se codifica `apps/core` y, por extensión, `apps/app` y `apps/control`.
**Fecha:** 2026-10-16.

## 1. Método: Kanban de flujo continuo con rebanadas verticales

- Un solo tablero, límite de **un** elemento en curso.
- La unidad de trabajo es la **rebanada**: un flujo de ARK-ARCH-002 de punta a punta.
- Cada rebanada se entrega completa o no se entrega.

Razones: hay una persona que decide (el owner) y un asistente que implementa. Los sprints y ceremonias largas pesan más que el trabajo. Los flujos ya están definidos en ARK-ARCH-002, así que se cierran de extremo a extremo.

## 2. Qué es una rebanada

Una rebanada incluye, en este orden:

1. **Contrato:** esquema zod en `packages/contracts` y, si hace falta, ruta en `services/api`.
2. **Permisos:** qué papel (owner, administrador del cliente, miembro) puede hacer qué, comprobado en la API.
3. **Pantalla:** en `apps/core`, conectada a la API, con los estados de la plantilla de diseño (normal, vacío, error, cargando).
4. **Pruebas:** de la API para el camino feliz, los permisos y los errores.
5. **Bitácora:** cada acción que cambia datos queda registrada.

Una rebanada **no** se marca como hecha si le falta alguna de esas partes.

## 3. Tablero

| Reabiertas | Backlog | Deuda | Listo para tomar | En curso (límite 1) | Revisión con el owner | Hecho |
|---|---|---|---|---|---|---|
| Rebanadas que no cumplen la definición de terminado | Rebanadas ordenadas | Arreglos técnicos, con límite propio | Con criterios de aceptación y estados escritos | Una | Demo corta con pruebas visibles | Commit solo cuando el owner lo pide |

- **Reabiertas** va primero: una rebanada marcada como hecha que no cumple la definición vuelve aquí antes que cualquier rebanada nueva.
- **Deuda** tiene su propio límite: por cada tres rebanadas nuevas se toma una de deuda. El límite de **una** en curso aplica a todo el tablero.
- Antes de tomar una rebanada se escribe qué estados muestra, qué acciones son destructivas y qué criterios de accesibilidad cumple.

## 4. Definición de terminado

Una rebanada está terminada cuando:

- [ ] Esquema zod en `packages/contracts`, usado tanto por la API como por la app.
- [ ] Rutas de la API con permisos explícitos y respuestas de error claras.
- [ ] Pruebas de la API: camino feliz, permisos, errores de negocio. La suite completa pasa.
- [ ] Pruebas de `apps/core` para las acciones de servidor y los componentes con lógica de negocio que la rebanada toca.
- [ ] Calidad automatizada: `pnpm quality` pasa (lint, typecheck y pruebas). Antes de cerrar la rebanada, `pnpm quality:full` también pasa (incluye `build`).
- [ ] Pantalla de `apps/core` conectada a la API, con todos los estados del diseño: normal, vacío, error y cargando. Cada ruta tiene su `loading.tsx` y `error.tsx`.
- [ ] Toda acción destructiva (eliminar, descartar, anular) pasa por el diálogo de confirmación compartido.
- [ ] Accesibilidad básica: cada campo tiene etiqueta, los grupos de casillas van en `fieldset` con `legend`, el foco es visible y no hay atributos ARIA en elementos que no los admiten.
- [ ] Sin duplicar: componentes y helpers comunes viven en un solo lugar (`components/ui` y `lib/`).
- [ ] Sin datos inventados en el código: lo que se muestra viene de la API.
- [ ] Sin secretos fuera de `.env.local`.
- [ ] Revisión en navegador en escritorio y en ancho de móvil, con capturas guardadas con la rebanada.
- [ ] Acciones registradas en la bitácora.

## 5. Ritmo

- **Al empezar una sesión:** se confirma la rebanada en curso y el criterio que falta.
- **Al terminar una rebanada:** demo corta con el owner. El owner acepta o pide cambios; solo entonces pasa a «hecho».
- **Cada semana:** revisión de lo entregado, lo bloqueado y el orden del backlog. Las decisiones técnicas que cambien el alcance se anotan en `docs/`.
- **Bloqueos:** si una rebanada depende de una decisión del owner (por ejemplo, D-11 o la sede fiscal), se marca «esperando decisión» y se toma la siguiente. No se detiene todo el tablero.
- **Exploración técnica:** límite de tiempo por investigación. Si no se resuelve dentro del límite, se documenta y se sigue.

## 6. Reglas de código

- Los datos de negocio solo viajan por la API. Las apps no leen la base de datos.
- Las formas de los datos se definen una vez, en `packages/contracts`.
- Ningún secreto en el repositorio. Las claves van en `.env.local`.
- Las acciones externas (correos, facturas, publicaciones) pasan por aprobación del owner.
- Commits solo cuando el owner lo pide.

## 7. Roles

- **Owner:** dueño del producto y aprobador. Ordena el backlog y acepta cada rebanada.
- **Desarrollo:** implementa la rebanada en curso, escribe las pruebas y la documentación afectada.
- **Agentes de la plataforma:** no participan en el desarrollo de CORE. Su trabajo se implementa en CONTROL.

## 8. Backlog de CORE, en orden

**Deuda de calidad (primero, porque las demás rebanadas dependen de ella):**

0. **Calidad:** scripts únicos (`pnpm quality`, `pnpm quality:full`), pruebas de `apps/core` y lint limpio.
1. **Componentes compartidos:** diálogo de confirmación, bloque de estado (vacío, error, cargando), fieldset para grupos de casillas, y un solo `Notice`.
2. **Rutas:** `error.tsx`, `not-found.tsx` y `loading.tsx` en todas las rutas que faltan.
3. **Pruebas de las acciones de servidor** de los módulos ya entregados.

**Rebanadas de flujo:**

4. **Proyectos:** vincular el proyecto con la propuesta de origen (F-05).
5. **Campañas:** detalle en pestañas (brief, piezas, landings).
6. **Editor de Insights:** barra de herramientas adaptada a móvil.
7. **Prueba de extremo a extremo** de tres flujos: lead a factura, aprobación de una pieza y publicación de un artículo.

**Módulos ya entregados que se reabren** hasta cumplir la definición de terminado: Leads, Clientes, Propuestas, Proyectos, Entregables, Cobros, Reuniones, Aprobaciones, Supresión, Campañas, Perfiles e Insights.

Fuera de este backlog por ahora: Agentes, Presupuesto y Pausas de emergencia. Dependen de la app de Control y se rediseñan después.

**Estado al 2026-10-18:**

- **0 Calidad — hecha.** `pnpm quality` (lint, tipos y pruebas) y `pnpm quality:full` (además, build) pasan en Core. Pruebas de Core: 4, sobre los helpers compartidos.
- **2 Rutas — hecha** para las rutas de Core entregadas: `error.tsx`, `not-found.tsx` y `loading.tsx`. Las rutas de Pausas quedan fuera de este backlog.
- **1 Componentes compartidos — parcial.** Hechos: `ConfirmAction`, `Notice` único y `PageLoading`. Aplicado a Campañas, Perfiles, Cobros e Insights. Pendiente de migrar a `ConfirmAction`: retirar personas (Clientes), eliminar y cancelar reuniones, eliminar acta (Reuniones), archivar proyecto (Proyectos), y eliminar o descartar lead (Leads). Pendiente también: `fieldset` para grupos de casillas.
- **3 Pruebas de acciones — pendiente.** Solo cubren los helpers. Faltan las acciones de cada módulo entregado.
- **Reabiertas:** los módulos de la lista de arriba siguen reabiertos hasta cumplir la definición de terminado completa.

## 9. Referencias

- Flujos: ARK-ARCH-002.
- Diseño de pantallas: `docs/design/` (y su copia autocontenida en `docs/design/standalone/`).
- Esquemas compartidos: `packages/contracts/src/`.
- Decisiones: ARK-CORE-002 y ARK-FW-001.
