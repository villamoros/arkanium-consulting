# PL-07 — Registro de cambios

**Fase:** Modernizar. **Entregable de:** compuerta G3. **Versión del framework:** ARK-FW-001.
**Redacta:** agente de la fase Modernizar que ejecutó el cambio. **Revisa:** agente de calidad. **Aprueba:** owner al cierre de cada etapa.

Es un registro técnico y continuo. Vive en core y su consulta es interna. Su resumen alimenta el avance que se publica al cliente (PL-06).

## Campos por cambio

| Campo | Descripción |
| --- | --- |
| ID | C-proyecto-001… |
| Fecha | Cuándo se aplicó el cambio. |
| Etapa | Etapa de la hoja de ruta a la que pertenece (PL-05). |
| Descripción | Qué cambió, en una o dos frases. |
| Motivo | Qué requisito o hallazgo lo origina (referencia a PL-01 o PL-03). |
| Alcance | Componentes o procesos afectados. |
| Evidencia de prueba | Referencia a la prueba o al registro que lo demuestra. |
| Resultado de la prueba | Aprobada, con observaciones o fallida. |
| Reversión | Cómo se deshace el cambio si es necesario. |
| Responsable | Agente o persona que lo ejecutó. |
| Aprobado por | Owner, con fecha. |

## Regla

Ningún cambio se marca como terminado sin evidencia de prueba y sin reversión documentada. Un cambio sin reversión no se aplica a producción.

## Criterios de completitud

- Todo cambio de la etapa aparece en el registro, sin excepciones.
- Todo cambio con resultado fallido tiene la acción tomada.
- El cierre de etapa (G3) requiere que todos los cambios estén aprobados o explícitamente revertidos.
