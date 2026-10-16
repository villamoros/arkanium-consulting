# PL-02 — Registro de riesgos

**Fase:** Evaluar. **Entregable de:** compuerta G1. **Versión del framework:** ARK-FW-001.
**Redacta:** agente de la fase Evaluar. **Revisa:** agente de calidad. **Aprueba:** owner. **Cliente:** recibe la versión resumida dentro del informe de hallazgos.

El registro vive en core y se actualiza en cada compuerta. Esta plantilla define su estructura.

## Campos por riesgo

| Campo | Descripción |
| --- | --- |
| ID | Identificador estable (R-001, R-002…). No se reutiliza. |
| Descripción | Qué podría pasar, en una o dos frases. |
| Causa | Qué lo originaría. |
| Impacto | Alto, medio o bajo. Alto si afecta la operación o el dinero del cliente (D-17). |
| Probabilidad | Alta, media o baja. |
| Nivel | Combinación de impacto y probabilidad, calculada según D-17. |
| Responsable | Persona u área que responde por el riesgo. |
| Mitigación | Acción concreta, con fecha objetivo. |
| Estado | Abierto, en mitigación, cerrado o aceptado. |
| Evidencia | Referencia al hallazgo que lo originó (PL-01). |
| Historial | Cambios de estado con fecha y responsable. |

## Regla de nivel (D-17)

- **Alto:** impacto alto, o probabilidad alta con impacto medio.
- **Medio:** impacto medio con probabilidad media o baja, o impacto bajo con probabilidad alta.
- **Bajo:** el resto.

## Criterios de completitud

- Todo riesgo alto tiene responsable, mitigación con fecha y evidencia.
- Ningún riesgo alto está en estado «aceptado» sin aprobación explícita del owner.
- Los riesgos cerrados se conservan con su historial. No se borran.
- Al cierre de cada etapa (G3) se revisa el registro completo y se deja constancia de la revisión.
