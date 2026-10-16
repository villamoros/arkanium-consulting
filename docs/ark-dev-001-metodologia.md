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

| Backlog | Listo para tomar | En curso (límite 1) | Revisión con el owner | Hecho |
|---|---|---|---|---|
| Rebanadas ordenadas | Con criterios de aceptación escritos | Una | Demo corta con pruebas visibles | Commit solo cuando el owner lo pide |

## 4. Definición de terminado

Una rebanada está terminada cuando:

- [ ] Esquema zod en `packages/contracts`, usado tanto por la API como por la app.
- [ ] Rutas de la API con permisos explícitos y respuestas de error claras.
- [ ] Pruebas de la API: camino feliz, permisos, errores de negocio. La suite completa pasa y el typecheck está limpio.
- [ ] Pantalla de `apps/core` conectada a la API, con los estados de la plantilla de diseño.
- [ ] Sin datos inventados en el código: lo que se muestra viene de la API.
- [ ] Sin secretos fuera de `.env.local`.
- [ ] Revisión en navegador en escritorio y en ancho de móvil.
- [ ] Acciones registradas en la bitácora.
- [ ] `build` o `typecheck` de la app pasa.

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

## 8. Backlog inicial de CORE, en orden

1. **Leads:** lista, detalle, calificar, posponer, descartar y convertir (F-01, F-02, F-04).
2. **Clientes:** organización, equipo, roles, suspender y reactivar (D-03).
3. **Proyectos e hitos** (F-05).
4. **Entregables:** subir, publicar y ver correcciones (F-08, A-03).
5. **Facturas:** borrador y emisión con Stripe en modo de prueba (F-10).
6. **Reuniones:** confirmar y publicar acta (F-03, F-09).
7. **Aprobaciones:** requiere endpoints de la cola de aprobaciones, aún no existentes.

Después de estas, van las pantallas sin API: supresión, presupuesto, pausas de emergencia y propuestas.

## 9. Referencias

- Flujos: ARK-ARCH-002.
- Diseño de pantallas: `docs/design/` (y su copia autocontenida en `docs/design/standalone/`).
- Esquemas compartidos: `packages/contracts/src/`.
- Decisiones: ARK-CORE-002 y ARK-FW-001.
