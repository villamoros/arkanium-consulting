# ARK-AGT-001 — ficha de agente

**Estado:** vigente. Define la ficha que describe a cada agente especialista. El registro de los 42 agentes está en `packages/agents/src/registry.json` y se valida contra el esquema `packages/agents/src/schema.ts`.
**Fecha:** 2026-10-15.

## 1. Estado actual

- **Todos los agentes están definidos y sin operación.** No se ejecutan, no reciben proyectos y no producen salidas.
- **Modelo:** claude. Se ejecutará a través del orquestador, no por llamadas directas a la API en esta fase. La versión concreta se fija cuando se elija el orquestador (ver ARK-INF-001).
- **Activación:** un agente pasa a «activo» solo cuando tú lo autorizas para un proyecto concreto.

## 2. Campos de la ficha

| Campo | Qué significa |
| --- | --- |
| `id` | Identificador estable: departamento y slug del servicio. |
| `name` | Nombre del puesto, en español, como aparece en el organigrama. |
| `department` | Arquitectura, estrategia o producto. |
| `category` | Categoría del catálogo a la que pertenece el servicio. |
| `service` | Servicio del catálogo que atiende (slug, etiqueta y familia). Un agente, un servicio. |
| `principalDeliverable` | El entregable que produce con más frecuencia. |
| `phases` | Fases del framework en las que puede trabajar (ARK-FW-001, sección 12). |
| `status` | `definido` (hoy), `activo` o `pausado`. |
| `operation` | `sin_operacion` (hoy) u `operando`. |
| `model` | Modelo que lo ejecuta. |
| `tools` | Herramientas permitidas. Vacío hasta definirlas por agente. |
| `approval` | Siempre `owner`. Toda salida externa requiere tu aprobación. |
| `workspace` | Siempre `proyecto`. Cada agente trabaja en el espacio de su proyecto. |

## 3. Qué falta en cada ficha antes de activarla

Estos puntos no están en el registro todavía y se completan por agente antes de activarlo:

1. **Entradas esperadas:** qué necesita para empezar (informe, datos, entrevista).
2. **Salidas y plantilla:** qué plantilla de ARK-FW-001 llena y en qué compuerta.
3. **Herramientas:** lista explícita. Sin herramienta no hay acción posible.
4. **Criterios de salida propios:** cómo sabe que terminó su parte.
5. **Límites:** qué no puede decidir ni hacer aunque se le pida.
6. **Casos de referencia:** cuáles de la biblioteca debe consultar primero (ARK-FW-001, sección 8).

## 4. Reglas que aplican a todos los agentes

- No firman, no aceptan responsabilidad profesional y no aprueban nada hacia el exterior.
- No se comunican con clientes directamente. Sus salidas llegan a ti a través de la cola de aprobaciones.
- No cambian precios, alcance ni acuerdos.
- Registran cada acción en la bitácora.
- Siguen el framework. Si algo no encaja, lo registran como excepción.

## 5. Proceso de activación (cuando llegue el momento)

1. Completar los campos de la sección 3 para el agente.
2. Revisar la ficha con el agente de calidad y con la PMO.
3. Autorizar la activación para un proyecto concreto.
4. Observar los primeros entregables con revisión completa antes de dar más autonomía.
