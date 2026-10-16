# PL-01 — Informe de hallazgos

**Fase:** Evaluar. **Entregable de:** compuerta G1. **Versión del framework:** ARK-FW-001.
**Redacta:** agente de la fase Evaluar del servicio. **Revisa:** agente de calidad. **Aprueba para publicar:** owner. **Cliente:** aprueba el alcance de la evaluación (D-18), no este informe, que se entrega como avance.

## Metadatos

| Campo | Contenido |
| --- | --- |
| Proyecto | Identificador del proyecto en core |
| Servicio | Servicio del catálogo (slug) |
| Fecha | Fecha de emisión (AAAA-MM-DD) |
| Versión | Número de revisión del informe |
| Autor | Agente (identificador) |
| Aprobado por | Owner (fecha y nombre) |

## Secciones

1. **Resumen ejecutivo.** Máximo una página. Qué se encontró, qué riesgo principal existe y qué se recomienda hacer primero. Sin jerga técnica.
2. **Alcance de la evaluación.** Qué sistemas, procesos y personas se revisaron, y qué quedó fuera.
3. **Contexto declarado.** Objetivos y restricciones que dio el cliente, con su fuente.
4. **Hallazgos.** Lista numerada. Cada hallazgo tiene: descripción, evidencia (archivo, métrica, entrevista o registro), impacto (alto, medio o bajo) y recomendación.
5. **Riesgos asociados.** Referencia cruzada al registro de riesgos (PL-02). Cada riesgo alto aparece aquí con su responsable.
6. **Qué no sabemos.** Información que faltó, supuestos usados y cómo afectan las conclusiones.
7. **Referencias a casos previos.** Si se consultó un caso de la biblioteca, su identificador y qué se tomó o descartó (ARK-FW-001, sección 8).

## Criterios de completitud

- Cada hallazgo tiene evidencia verificable. Un hallazgo sin evidencia no entra.
- Cada riesgo alto de PL-02 aparece en la sección 5 con responsable.
- La sección 6 existe aunque esté vacía, indicando que no hubo faltantes.
- El resumen ejecutivo se entiende sin leer el resto.
- El lenguaje es el del cliente: términos de negocio primero, técnicos después.

## Errores frecuentes a evitar

- Hallazgos sin evidencia («parece que...»).
- Recomendaciones sin hallazgo que las respalde.
- Mezclar lo que el cliente dijo con lo que se observó: son fuentes distintas y se indican por separado.
