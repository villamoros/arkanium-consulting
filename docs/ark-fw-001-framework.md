# ARK-FW-001 — Arkanium Framework

**Estado:** borrador. Es la restricción que siguen todos los agentes. Vive en core y lo mantiene la PMO (ARK-ARCH-003).
**Fecha:** 2026-10-15.
**Alcance:** las cuatro fases del framework, sus plantillas, criterios de salida y el registro de casos. Empieza con la familia Arquitectura.

---

## 1. Premisa

Cada caso es único. El framework define **cómo** se trabaja; el caso define **qué** se resuelve.

Consecuencias:
- Ningún agente puede saltarse una fase ni una compuerta (criterio de salida).
- Un agente que consulta casos previos debe citar cuál consultó y explicar qué adaptó. No copia soluciones.
- Si un caso necesita algo que el framework no contempla, el agente **no improvisa**: lo registra como excepción y lo escala a la PMO para decidir si el framework se actualiza.

## 2. Fases

El framework tiene cuatro fases. Un proyecto avanza de una a otra solo cuando cumple los criterios de salida de la anterior.

| Fase | Objetivo | Pregunta que responde |
| --- | --- | --- |
| **1. Evaluar** | Entender el negocio, los sistemas, los riesgos y las restricciones. | ¿Qué tenemos y qué nos pone en riesgo? |
| **2. Arquitectar** | Diseñar la solución o la ruta de cambio. | ¿Cómo debería verse la solución? |
| **3. Modernizar** | Ejecutar el cambio por etapas con control de riesgo. | ¿Cómo llegamos sin romper lo que funciona? |
| **4. Escalar** | Estabilizar, medir y preparar el crecimiento. | ¿Cómo sostenemos y crecemos el resultado? |

No todos los servicios llegan a las cuatro fases. Un diagnóstico cubre solo **Evaluar**. Una hoja de ruta llega hasta **Arquitectar**. Un proyecto completo recorre las cuatro. El alcance de cada servicio define hasta dónde llega.

## 3. Fase 1 — Evaluar

**Objetivo:** entender el negocio, los sistemas, los riesgos y las restricciones antes de proponer cualquier cambio.

**Entradas mínimas:** contexto del cliente, inventario de sistemas disponible, objetivos declarados, restricciones (presupuesto, plazos, personas, regulación).

**Actividades:**
1. Revisión de arquitectura: mapear componentes, dependencias y puntos de falla.
2. Evaluación de riesgo técnico: clasificar cada riesgo por impacto y probabilidad, con responsable asignado.
3. Entrevistas con personas clave del cliente, con registro de lo que se dijo.
4. Identificar lo que el negocio usa de lo que solo existe por inercia.

**Entregables:**
- **Informe de hallazgos** (plantilla PL-01): hallazgos priorizados, evidencias y recomendaciones.
- **Registro de riesgos** (plantilla PL-02): cada riesgo con responsable, mitigación y estado.

**Criterios de salida (compuerta G1):**
- Cada hallazgo tiene una evidencia que lo respalda.
- Cada riesgo alto tiene responsable y mitigación propuesta.
- El cliente validó el alcance de la fase, con su confirmación registrada.
- El owner aprobó el informe de hallazgos para publicarlo.

## 4. Fase 2 — Arquitectar

**Objetivo:** diseñar la solución o la ruta de cambio, con decisiones documentadas y alternativas evaluadas.

**Entradas mínimas:** informe de hallazgos aprobado (G1), registro de riesgos, restricciones confirmadas.

**Actividades:**
1. Definir al menos dos alternativas de solución y compararlas por costo, riesgo, plazo y mantenibilidad.
2. Diseñar componentes, flujos de datos e integraciones.
3. Registrar cada decisión con su razón, sus alternativas descartadas y quién la aprobó.
4. Definir la hoja de ruta por etapas, con criterios de avance entre etapas.

**Entregables:**
- **Diseño de arquitectura** (plantilla PL-03): componentes, flujos, integraciones y decisiones.
- **Registro de decisiones** (plantilla PL-04): una entrada por decisión, con su contexto y alternativas.
- **Hoja de ruta por etapas** (plantilla PL-05): etapas, criterios de avance y responsables.

**Criterios de salida (compuerta G2):**
- Existe al menos una alternativa descartada con razón documentada.
- Cada decisión tiene aprobación registrada.
- El diseño cubre todos los riesgos altos del registro de G1.
- El owner aprobó la hoja de ruta para publicarla al cliente.

## 5. Fase 3 — Modernizar

**Objetivo:** ejecutar el cambio por etapas, con control de riesgo y sin interrumpir la operación del cliente.

**Entradas mínimas:** hoja de ruta aprobada (G2), criterios de avance por etapa, responsables asignados.

**Actividades:**
1. Ejecutar una etapa a la vez. No se empieza una etapa sin cerrar la anterior.
2. Registrar cada cambio con su evidencia de prueba.
3. Revisar riesgos al cierre de cada etapa y actualizar el registro.
4. Reportar avance al cliente con el formato de avance (plantilla PL-06).

**Entregables:**
- **Avance por etapa** (plantilla PL-06): qué se hizo, qué se probó, riesgos y próximos pasos.
- **Registro de cambios** (plantilla PL-07): cada cambio con su evidencia.

**Criterios de salida por etapa (compuerta G3):**
- Las pruebas de la etapa pasan y su evidencia está registrada.
- No hay riesgos altos sin mitigación.
- El cliente recibió el avance de la etapa.
- El owner aprobó el cierre de la etapa.

## 6. Fase 4 — Escalar

**Objetivo:** estabilizar el resultado, medirlo y dejar al cliente en condiciones de sostenerlo.

**Entradas mínimas:** todas las etapas cerradas (G3), métricas acordadas al inicio, plan de operación.

**Actividades:**
1. Medir el resultado contra las métricas acordadas en F1.
2. Documentar la operación: qué se monitorea, quién responde, cómo se escala un incidente.
3. Transferir conocimiento al equipo del cliente, con sesiones registradas.
4. Preparar el cierre o la continuidad del servicio.

**Entregables:**
- **Informe final** (plantilla PL-08): resultados medidos, lecciones y recomendaciones.
- **Guía de operación** (plantilla PL-09): monitoreo, responsables y procedimientos.
- **Ficha de caso** (plantilla PL-10): el registro que alimenta la biblioteca de casos (sección 7).

**Criterios de salida (compuerta G4):**
- El informe final muestra resultados medidos, no solo esperados. Si no se midieron, se indica.
- El cliente recibió la guía de operación y confirmó la transferencia.
- El owner aprobó el informe final y el cierre del proyecto.
- La ficha de caso está completa.

## 7. Registro de casos

Cada proyecto cerrado genera una **ficha de caso** (PL-10). Es la fuente que consulta la biblioteca de casos de los agentes.

Campos obligatorios:
- **Identificación:** servicio, familia, fecha de inicio y cierre, tipo de cobro.
- **Contexto:** sector, tamaño y problema declarado (sin nombre del cliente en la versión de consulta interna, si D-11 lo exige).
- **Decisiones clave:** las que quedaron en el registro de decisiones de F2, con su razón.
- **Alternativas descartadas:** y por qué.
- **Riesgos materializados:** qué pasó, cómo se resolvió.
- **Resultados medidos:** contra las métricas acordadas.
- **Lecciones:** qué cambiaría el equipo y qué se propone al framework.
- **Excepciones al framework:** cualquier cosa que no encajó, y cómo se resolvió.

La ficha se escribe al cierre (G4). Un proyecto sin ficha completa no se considera cerrado.

## 8. Reglas de los agentes

1. **Seguir el framework.** Un agente no omite fases, compuertas ni plantillas.
2. **Citar la referencia.** Cuando consulta un caso previo, lo cita con su identificador y explica qué tomó y qué adaptó.
3. **Escalar excepciones.** Si algo no encaja en el framework, lo registra como excepción y la PMO decide.
4. **No actuar fuera de su fase.** Un agente de la fase 2 no ejecuta cambios de la fase 3.
5. **Registrar todo.** Cada decisión y cada salida queda en la bitácora (C-07).

## 9. Plantillas

| ID | Plantilla | Fase | Uso |
| --- | --- | --- | --- |
| PL-01 | Informe de hallazgos | Evaluar | Entregable de G1 |
| PL-02 | Registro de riesgos | Evaluar | Entregable de G1 |
| PL-03 | Diseño de arquitectura | Arquitectar | Entregable de G2 |
| PL-04 | Registro de decisiones | Arquitectar | Entregable de G2 |
| PL-05 | Hoja de ruta por etapas | Arquitectar | Entregable de G2 |
| PL-06 | Avance por etapa | Modernizar | Entregable de G3 |
| PL-07 | Registro de cambios | Modernizar | Entregable de G3 |
| PL-08 | Informe final | Escalar | Entregable de G4 |
| PL-09 | Guía de operación | Escalar | Entregable de G4 |
| PL-10 | Ficha de caso | Escalar | Alimenta la biblioteca |

Las plantillas se escriben en core. Su contenido exacto se define en el contrato de cada flujo que las usa (capa 3).

## 10. Gobierno del framework

- **Dueño:** la PMO, bajo tu aprobación.
- **Cambios:** cualquier cambio al framework pasa por una excepción registrada, una evaluación de la PMO y tu aprobación. Los agentes no lo modifican.
- **Versión:** cada proyecto queda ligado a la versión del framework vigente al iniciar. Un proyecto en curso no cambia de versión a mitad de camino.

## 11. Decisiones

- **Riesgo alto (D-17):** un riesgo es alto si tiene impacto alto en la operación o en el dinero del cliente, o si tiene probabilidad alta con cualquier impacto relevante. Cada riesgo alto necesita responsable y mitigación antes de G1 o G3.
- **Aprobación del cliente (D-18):** el cliente aprueba formalmente G1 (alcance de la evaluación) y G2 (diseño y hoja de ruta). En G3 solo recibe el avance. En G4 confirma la transferencia.
- **Firma del owner (D-16):** todas las compuertas las aprueba el owner, hasta contratar personal que lo haga.

## 12. Aplicación por familia

El framework es el mismo para todas las familias. Lo que cambia es el tramo de fases que cubre cada servicio, según su definición en el catálogo.

| Familia | Fases que cubre con mayor frecuencia | Notas |
| --- | --- | --- |
| **Arquitectura** | Evaluar, Arquitectar, Modernizar, Escalar | Es la familia que recorre el framework completo. Primer departamento en activarse. |
| **Estrategia** | Evaluar, Arquitectar | Diagnósticos, estrategias y hojas de ruta. Entrega el diseño y la ruta, no la ejecución. Cuando el cliente contrata la ejecución, pasa a Arquitectura. |
| **Producto** | Evaluar, Arquitectar | Descubrimiento, definición y preparación de MVP. La construcción del MVP no es un servicio de esta familia. Pasa a Arquitectura o a un proyecto de desarrollo. |

Un servicio de Estrategia o Producto que llega a G2 con un diseño aprobado y el cliente decide construir se convierte en un proyecto de Arquitectura, con la misma ficha de caso y el mismo registro de decisiones.

**Supuesto a validar:** que la construcción del MVP se trate como proyecto de Arquitectura y no como una cuarta familia. Si cambias esto, se actualiza esta sección y ARK-ARCH-003.
