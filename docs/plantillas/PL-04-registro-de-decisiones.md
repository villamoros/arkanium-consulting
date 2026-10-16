# PL-04 — Registro de decisiones

**Fase:** Arquitectar. **Entregable de:** compuerta G2. **Versión del framework:** ARK-FW-001.
**Redacta:** agente de la fase Arquitectar. **Aprueba:** owner (cada decisión), y el cliente cuando afecta al alcance o al costo, según D-18.

Es un registro acumulativo: cada decisión se agrega como entrada nueva. Una decisión cambiada no se edita: se marca como reemplazada y se enlaza la nueva.

## Campos por decisión

| Campo | Descripción |
| --- | --- |
| ID | D-proyecto-001, D-proyecto-002… |
| Fecha | Cuándo se tomó. |
| Contexto | Qué problema obliga a decidir. |
| Alternativas | Lo que se consideró, con su costo y riesgo en una línea cada una. |
| Decisión | Lo que se eligió, en una frase. |
| Razón | Por qué se eligió sobre las demás. |
| Consecuencias | Qué cambia, qué se vuelve más difícil y qué riesgo nuevo aparece. |
| Aprobada por | Owner y, si aplica, cliente, con fecha. |
| Estado | Vigente, reemplazada (con el ID que la reemplaza). |
| Referencias | Casos de la biblioteca consultados, con su identificador. |

## Criterios de completitud

- Toda decisión tiene al menos dos alternativas y la razón de la elección.
- Toda decisión vigente tiene aprobación registrada.
- Las decisiones reemplazadas conservan su texto original.
- Las decisiones que afectan al alcance o al costo tienen aprobación del cliente antes de la compuerta G2.
