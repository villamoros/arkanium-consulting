# PL-10 — Ficha de caso

**Fase:** Escalar. **Entregable de:** compuerta G4. **Versión del framework:** ARK-FW-001.
**Redacta:** agente bibliotecario, a partir de los entregables del proyecto. **Revisa:** agente de calidad. **Aprueba:** owner.

Es la unidad de la biblioteca de casos (ARK-ARCH-003, sección 6). Cada ficha describe un caso cerrado para que otros agentes aprendan cómo se trabaja, no para copiar su solución.

**Uso interno únicamente.** Solo la consultan los agentes de proyectos nuevos, en modo lectura, y el owner. Ningún cliente la ve.

## Campos obligatorios

### Identificación
- Servicio (slug del catálogo) y familia.
- Fecha de inicio y de cierre.
- Tipo de cobro (precio fijo por hitos, retainer, tiempo y materiales con tope, o diagnóstico).
- Proyecto contratado o interno (D-08).
- Identificador del cliente: **según D-11** (nombre completo, o identificador anonimizado si el contrato no permite el uso completo).

### Contexto
- Sector y tamaño de la organización, en rangos.
- Problema declarado por el cliente, en sus propias palabras resumidas.
- Restricciones que condicionaron el trabajo (presupuesto, plazos, regulación, sistemas heredados).

### Recorrido
- Fases recorridas y fecha de cada compuerta (G1 a G4).
- Entregables principales, con su identificador.
- Decisiones clave, con referencia a PL-04 y su razón.
- Alternativas descartadas y por qué.

### Resultados
- Métricas acordadas, con su línea base.
- Resultados medidos y su fuente.
- Lo que no se logró y por qué.

### Aprendizaje
- Riesgos que se materializaron y cómo se resolvieron.
- Lecciones: qué se haría distinto y qué se propone al framework.
- Excepciones al framework: qué no encajó, cómo se resolvió y si la PMO propone un cambio.

## Reglas

- La ficha describe el razonamiento y los resultados. No copia textos del cliente ni entregables completos.
- Un proyecto sin ficha completa no se considera cerrado (ARK-FW-001, sección 7).
- Las fichas no se editan después de aprobadas: si hay un error, se agrega una nota con fecha y el motivo.

## Criterios de completitud

- Todos los campos obligatorios están llenos o indican explícitamente «no aplica» con su razón.
- Los resultados distinguen lo medido de lo esperado.
- La sección de excepciones existe aunque esté vacía.
