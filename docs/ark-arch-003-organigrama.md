# ARK-ARCH-003 — organigrama de Arkanium

**Estado:** borrador vigente. Define la estructura administrativa y operativa completa. Lo que queda aquí determina qué agentes existen y qué puede hacer cada uno.
**Fecha:** 2026-10-15.
**Relación:** ARK-ARCH-001 (entidades, roles, frontera y cobro), ARK-ARCH-002 (flujos) y ARK-FW-001 (framework). Este documento define quién ejecuta cada flujo.
**Cobertura:** las tres familias del catálogo: **Arquitectura** (13 servicios), **Estrategia** (14) y **Producto** (15). Total: 42 servicios, 42 agentes especialistas.

---

## 1. Principio

Arkanium se organiza como una consultora de software real: áreas administrativas que operan el negocio y áreas operativas que entregan los servicios. Cada área tiene un responsable humano, objetivos medibles y un costo asignado.

**Regla de responsabilidad:** cada área tiene exactamente un responsable humano. Hoy todas son tuyas. Los agentes ejecutan. Nunca firman, nunca aceptan responsabilidad profesional y nunca aprueban lo que sale hacia un cliente.

**Firma:** tú firmas las propuestas de todos los servicios, hasta que se contrate personal que lo haga (D-16).

## 2. Estructura administrativa

| Área | Responsable | Agentes | Qué hace | Flujos (ARK-ARCH-002) |
| --- | --- | --- | --- | --- |
| **Dirección** | Owner | Ninguno | Aprueba todo lo que sale al exterior. Define prioridades y precios. | Aprobaciones transversales |
| **Ventas** | Owner | Agente de captación, Agente de calificación | Recibe y califica leads, prepara propuestas y reuniones. | F-01, F-02, F-03, F-04 |
| **Mercadeo** | Owner | Agente de campañas, Agente de contenido | Define buyer personas, lanza campañas y publica Insights. | F-07, F-11 |
| **Operaciones comerciales** | Owner | Agente de contratos, Agente de proyectos | Convierte la propuesta en proyecto con alcance y precio. | F-04, F-05 |
| **Finanzas** | Owner | Agente de facturación, Agente de conciliación | Emite facturas, concilia pagos de Stripe y controla cobros vencidos. | F-10, C-04 |
| **Legal y cumplimiento** | Owner, con asesor externo | Agente de contratos y cumplimiento | Revisa términos, anexos y cláusulas de confidencialidad. No da asesoría legal. | Soporte a F-05 |
| **Administración** | Owner | Agente administrativo | Gestiona calendario, actas y documentación interna. | F-09 |
| **Éxito del cliente** | Owner | Agente de seguimiento | Revisa avances y prepara recordatorios de reuniones y entregables pendientes. | A-02, A-05 |

## 3. Estructura operativa

### 3.1 Áreas transversales

| Área | Responsable | Agentes | Qué hace |
| --- | --- | --- | --- |
| **Oficina de proyectos (PMO)** | Owner | Agente PMO | Mantiene el framework (ARK-FW-001), verifica que cada proyecto cumpla sus fases y lleva el registro de casos. |
| **Calidad** | Owner | Agente de revisión de calidad | Revisa cada entregable antes de la aprobación del owner. Verifica plantilla y criterios. |
| **Biblioteca de casos** | Owner | Agente bibliotecario | Registra la ficha de cada caso cerrado y mantiene la consulta de casos previos (ARK-ARCH-003, sección 6). |
| **Seguridad y acceso** | Owner | Agente de seguridad | Revisa permisos de agentes y accesos de clientes. Detecta acciones fuera de alcance. |

### 3.2 Departamento de Arquitectura

**Responsable humano:** owner, hasta asignar un arquitecto senior.

**Consultoría de arquitectura**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de evaluación de arquitectura | Evaluación de arquitectura | Informe de hallazgos y riesgos |
| Agente de hoja de ruta de modernización | Hoja de ruta de modernización de arquitectura | Roadmap por fases con criterios de avance |
| Agente de diseño de arquitectura de solución | Diseño de arquitectura de solución | Componentes, flujos e integraciones |
| Agente de due diligence técnica | Due diligence técnica | Informe de riesgo técnico para inversión o compra |
| Agente de arquitecto fraccional | Arquitecto fraccional | Revisiones periódicas y decisiones documentadas |

**Gobierno tecnológico**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de comité de arquitectura | Comité de revisión de arquitectura (como servicio) | Actas de decisiones de arquitectura |
| Agente de marco de gobierno | Diseño del marco de gobierno | Marco de decisiones, roles y criterios |
| Agente de retainer de gobierno | Retainer de gobierno | Revisión mensual de decisiones y riesgos |
| Agente de riesgo técnico | Monitoreo de riesgo técnico | Registro de riesgos con responsables |

**Liderazgo tecnológico**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de asesoría de CTO ligera | Asesoría de CTO (ligera) | Recomendaciones trimestrales |
| Agente de liderazgo técnico integrado | Liderazgo técnico integrado | Plan de liderazgo y decisiones por sprint |
| Agente de CTO fraccional, nivel crecimiento | CTO fraccional — nivel crecimiento | Plan técnico anual y revisiones mensuales |
| Agente de CTO fraccional, nivel startup | CTO fraccional — nivel startup | Plan técnico inicial y revisiones quincenales |

### 3.3 Departamento de Estrategia

**Responsable humano:** owner, hasta asignar un estratega senior.

**Diagnóstico tecnológico**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de diagnóstico tecnológico completo | Diagnóstico tecnológico completo | Diagnóstico integral con prioridades |
| Agente de sprint de descubrimiento pagado | Sprint de descubrimiento pagado | Hallazgos y recomendación de siguiente paso |
| Agente de chequeo técnico | Chequeo técnico | Resumen de salud técnica y riesgos principales |

**Estrategia digital**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de portafolio de iniciativas | Portafolio de iniciativas digitales | Portafolio priorizado de iniciativas |
| Agente de madurez digital | Evaluación de madurez digital | Evaluación por dimensiones y brechas |
| Agente de taller de oportunidades | Taller de oportunidades digitales | Lista de oportunidades evaluadas |
| Agente de blueprint de estrategia digital | Blueprint de estrategia digital | Estrategia digital con hitos |

**Estrategia tecnológica**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de construir vs. comprar | Análisis de construir vs. comprar | Recomendación con costo total y riesgos |
| Agente de caso de inversión en deuda técnica | Caso de inversión en deuda técnica | Caso financiero y priorización de deuda |
| Agente de blueprint de estrategia tecnológica | Blueprint de estrategia tecnológica | Estrategia tecnológica con hitos |
| Agente de sprint de estrategia tecnológica | Sprint de estrategia tecnológica | Estrategia tecnológica acotada a un sprint |

**Hoja de ruta de TI**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de hoja de ruta de TI | Hoja de ruta de TI (12-24 meses) | Hoja de ruta por trimestres |
| Agente de sprint de hoja de ruta | Sprint de hoja de ruta de TI | Hoja de ruta acotada a un sprint |
| Agente de actualización trimestral | Actualización trimestral de la hoja de ruta | Hoja de ruta actualizada y cambios justificados |

### 3.4 Departamento de Producto

**Responsable humano:** owner, hasta asignar un director de producto.

**Descubrimiento de producto**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de taller de descubrimiento | Taller de descubrimiento | Hallazgos del taller y preguntas abiertas |
| Agente de evaluación de oportunidad | Evaluación de oportunidad y viabilidad | Análisis de viabilidad con criterios de decisión |
| Agente de sprint de descubrimiento | Sprint de descubrimiento de producto | Hallazgos y recomendación de siguiente paso |
| Agente de experimentos de validación | Experimentos de validación de producto | Diseño y resultados de experimentos |

**Definición de producto**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de paquete de definición | Paquete de definición de producto | Definición de producto aprobable |
| Agente de requisitos y backlog | Requisitos de producto y backlog | Requisitos priorizados y backlog |
| Agente de visión y alcance | Taller de visión y alcance de producto | Visión y alcance firmados por el cliente |
| Agente de especificación técnica | Especificación técnica de producto | Especificación lista para construcción |

**Estrategia de MVP**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de taller de alcance de MVP | Taller de definición de alcance del MVP | Alcance del MVP con exclusiones |
| Agente de estrategia y hoja de ruta de MVP | Estrategia y hoja de ruta del MVP | Hoja de ruta del MVP por etapas |
| Agente de revisión de preparación | Revisión de preparación para construir el MVP | Informe de preparación con condiciones |

**Gestión de producto**

| Agente especialista | Servicio del catálogo | Entregable principal |
| --- | --- | --- |
| Agente de director de producto fraccional | Director de producto fraccional | Plan de producto y revisiones periódicas |
| Agente de product manager fraccional | Product Manager fraccional | Backlog gestionado y revisiones de sprint |
| Agente de asesoría de producto ligera | Asesoría de producto (ligera) | Recomendaciones periódicas |
| Agente de modelo operativo de producto | Diseño del modelo operativo de producto | Modelo operativo y roles de producto |

## 4. Reglas de agentes

1. **Un agente, un servicio.** Cada agente especialista atiende un servicio del catálogo y no otro.
2. **Acceso por proyecto.** Un agente solo ve los datos del proyecto que se le asignó, más la biblioteca de casos en modo de lectura (sección 6).
3. **Sin salidas externas directas.** Todo entregable pasa por calidad y luego por tu aprobación en core (F-08).
4. **Costo asignado.** Cada agente tiene un costo de operación y un servicio que factura. Si un servicio no se vende, su agente se pausa.
5. **Identidad registrada.** Cada agente tiene un identificador único y su historial queda en la bitácora (C-07).

## 5. Ramas de rentabilidad

Como el negocio debe ser rentable, cada familia se mide por separado desde el primer proyecto:
- ingreso por servicio vendido;
- costo de operación de sus agentes;
- margen por servicio y por familia;
- servicios con más retrabajo (correcciones del cliente o del área de calidad).

Un servicio con margen negativo dos ciclos seguidos se revisa: se ajusta el precio, el alcance o el agente.

## 6. Biblioteca de casos (excepción de conocimiento)

Esta sección modifica ARK-ARCH-001 en un punto. Así lo decidiste: los agentes de cada nuevo proyecto consultan los casos previos completos, para aprender cómo trabaja Arkanium.

**Cómo funciona:**
- Cada proyecto cerrado genera una ficha de caso (ARK-FW-001, sección 7), guardada en core.
- Cada proyecto nuevo tiene su propio espacio de trabajo para sus agentes (un tenant de agentes). Ese espacio puede **leer** la biblioteca de casos, pero no escribir en ella.
- Los agentes citan el caso que consultaron en cada decisión.

**Qué no cambia:**
- El **manual de caso** de un proyecto sigue siendo de ese proyecto. Lo que se comparte es el registro del caso cerrado, no el trabajo en curso.
- Ningún cliente ve la biblioteca: ni el contenido de otros casos ni sus nombres.
- El framework (ARK-FW-001) es la restricción. Consultar un caso sirve para entender cómo se resolvió, no para copiar la solución.

**Condición pendiente (D-11):** consultar casos completos de otros clientes puede chocar con los acuerdos de confidencialidad. Antes de construir la biblioteca hay que confirmar con un abogado que los contratos permiten ese uso interno. Si no lo permiten, la alternativa es guardar la ficha con datos del cliente anonimizados.

## 7. Decisiones

| # | Decisión |
| --- | --- |
| D-12 | Cada área tiene un responsable humano. Los agentes ejecutan y nunca firman. |
| D-13 | Las tres familias del catálogo se organizan como departamentos: Arquitectura (13 agentes), Estrategia (14) y Producto (15). |
| D-14 | Un agente atiende un servicio. Acceso solo a los proyectos asignados, más la biblioteca en lectura. |
| D-15 | Los agentes consultan casos completos de otros clientes, con el caso citado en cada decisión. |
| D-16 | El owner firma las propuestas de todos los servicios, hasta contratar personal que lo haga. |
| D-11 | Pendiente: confirmar con un abogado que los contratos permiten el uso interno de casos previos. |

## 8. Preguntas abiertas

Ninguna por ahora. Las dos preguntas anteriores quedaron resueltas en D-16 y en ARK-FW-001, sección 3 (umbral de riesgo alto).

## 9. Orden de activación

1. **Arquitectura** primero, como lo definiste.
2. **Estrategia** y **Producto** después, cuando Arquitectura tenga al menos un caso completo cerrado con su ficha. Así la biblioteca ya tiene material de referencia para las otras dos familias.
