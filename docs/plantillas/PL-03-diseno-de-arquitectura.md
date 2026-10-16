# PL-03 — Diseño de arquitectura

**Fase:** Arquitectar. **Entregable de:** compuerta G2. **Versión del framework:** ARK-FW-001.
**Redacta:** agente de la fase Arquitectar del servicio. **Revisa:** agente de calidad. **Aprueba para publicar:** owner. **Cliente:** aprueba la hoja de ruta que sale de este diseño (D-18).

## Metadatos

Mismos que PL-01, más: **Alternativas evaluadas** (número) y **Decisiones registradas** (referencia a PL-04).

## Secciones

1. **Problema que resuelve.** Referencia al informe de hallazgos aprobado (G1) y a los riesgos que este diseño atiende.
2. **Alternativas evaluadas.** Mínimo dos. Cada una con descripción, costo estimado, riesgo principal, plazo y mantenibilidad. La alternativa elegida se marca.
3. **Componentes.** Qué piezas existen en la solución, qué hace cada una y quién la opera.
4. **Flujos de datos.** Cómo viaja la información entre componentes, con el dato que cruza cada frontera.
5. **Integraciones.** Sistemas externos que se conectan, con su forma de autenticación y su responsable del lado del cliente.
6. **Seguridad y permisos.** Quién accede a qué, y cómo se controla. Incluye datos personales y su tratamiento.
7. **Decisiones.** Resumen de las decisiones de PL-04, con la alternativa elegida y la razón.
8. **Riesgos residuales.** Riesgos que persisten después del diseño, con referencia a PL-02.
9. **Supuestos.** Lo que se dio por cierto para diseñar. Cada supuesto indica quién debe confirmarlo.

## Criterios de completitud

- Existen al menos dos alternativas y la descartada tiene su razón (sección 2).
- Cada riesgo alto de PL-02 está cubierto por el diseño o aparece en riesgos residuales.
- Cada decisión tiene aprobación registrada en PL-04.
- Todo supuesto tiene responsable de confirmarlo.
- El diseño puede implementarse sin preguntas adicionales por parte del equipo técnico.

## Vínculo con el contrato del flujo

Si el diseño incluye un componente que maneja datos de clientes o pagos, el contrato del flujo correspondiente (ARK-ARCH-002) debe citar esta sección.
