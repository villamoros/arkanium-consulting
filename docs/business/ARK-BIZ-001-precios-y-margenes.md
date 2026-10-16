# ARK-BIZ-001 — precios, costos y márgenes

**Estado:** estructura. Los precios, horas y márgenes se llenan con tu criterio. No hay cifras inventadas en este documento.
**Fecha:** 2026-10-15.
**Relación:** ARK-ARCH-001 (sección 6, cobro), ARK-ARCH-003 (organigrama y rentabilidad) y ARK-LEG-002 (SOW).

---

## 1. Principio

Cada servicio tiene un precio, un costo y un margen. El costo de un servicio lo forman las horas de sus agentes y las horas de revisión humana. Si el margen de un servicio es negativo dos ciclos seguidos, se revisa (ARK-ARCH-003, sección 5).

## 2. Fórmula del costo de un servicio

```text
Costo del servicio = (horas de agente × costo por hora de agente)
                   + (horas de revisión humana × costo por hora de revisión)
                   + costo de herramientas y proveedores asignados
                   + costo de calidad (revisión del agente de calidad)
```

- **Costo por hora de agente:** se calcula desde el consumo de modelo y de infraestructura del mes, dividido entre las horas de agente ejecutadas. Se mide en la bitácora (ARK-ARCH-002, C-07). Todavía no hay datos porque los agentes no operan.
- **Horas de revisión humana:** es tu tiempo y el de quien lo reemplace. Es el costo más importante a controlar, porque toda salida externa pasa por ti.
- **Costo de herramientas:** suscripciones y servicios de terceros asignados al servicio.

## 3. Modalidades de cobro

Las modalidades salen de ARK-ARCH-001, sección 6. La columna «modalidad propuesta» de la tabla es una sugerencia por tipo de servicio que tú confirmas o cambias.

| Modalidad | Cuándo | Cómo se cobra |
| --- | --- | --- |
| Precio fijo, anticipo al inicio | Diagnósticos, sprints, talleres y evaluaciones | Anticipo en Checkout de Stripe; factura final al entregar |
| Precio fijo por hitos | Hojas de ruta, blueprints, estrategias e implementaciones | Una factura por hito aprobado (D-06) |
| Retainer mensual | Servicios continuos (CTO fraccional, gobierno, asesoría) | Suscripción mensual en Stripe |
| Tiempo y materiales con tope | Cuando el alcance no está definido | Facturas periódicas hasta el tope del SOW |

## 4. Reglas de precio

1. **Ningún precio se publica en el sitio sin tu aprobación.** Hoy el sitio no muestra precios: el contenido de servicios no tiene importes publicados. Si decides mostrarlos, se agregan con tu aprobación.
2. **Cada SOW tiene su precio.** El precio de catálogo es una referencia, no un compromiso.
3. **Un cambio de alcance requiere orden de cambio firmada** (ARK-LEG-002, sección 4). Sin ella no se factura trabajo adicional.
4. **Los descuentos los apruebas tú** y quedan registrados en la bitácora.
5. **Los internos (D-08)** no se facturan. Su costo se registra como inversión en el proyecto que los origina.

## 5. Tabla de servicios

Los 42 servicios del catálogo, con su agente especialista. Columnas por completar:
- **Precio:** el que apruebas para el servicio.
- **Horas de agente:** estimación de las horas de agente que consume una entrega típica.
- **Costo de agentes:** horas × costo por hora, con el costo real cuando haya datos.
- **Margen objetivo:** el que te propones para ese servicio.

Al llenar la tabla, un margen negativo se marca como revisión.


### Arquitectura

| Servicio | Categoría | Modalidad propuesta | Precio (USD) | Horas de agente (est.) | Costo de agentes | Margen objetivo |
|---|---|---|---|---|---|---|
| Evaluación de arquitectura | Consultoría de arquitectura | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Hoja de ruta de modernización de arquitectura | Consultoría de arquitectura | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Diseño de arquitectura de solución | Consultoría de arquitectura | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Due diligence técnica | Consultoría de arquitectura | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Arquitecto fraccional | Consultoría de arquitectura | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Comité de revisión de arquitectura (como servicio) | Gobierno tecnológico | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Diseño del marco de gobierno | Gobierno tecnológico | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Retainer de gobierno | Gobierno tecnológico | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Monitoreo de riesgo técnico | Gobierno tecnológico | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Asesoría de CTO (ligera) | Liderazgo tecnológico | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Liderazgo técnico integrado | Liderazgo tecnológico | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| CTO fraccional — nivel crecimiento | Liderazgo tecnológico | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| CTO fraccional — nivel startup | Liderazgo tecnológico | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |

### Estrategia

| Servicio | Categoría | Modalidad propuesta | Precio (USD) | Horas de agente (est.) | Costo de agentes | Margen objetivo |
|---|---|---|---|---|---|---|
| Diagnóstico tecnológico completo | Diagnóstico tecnológico | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Sprint de descubrimiento pagado | Diagnóstico tecnológico | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Chequeo técnico | Diagnóstico tecnológico | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Portafolio de iniciativas digitales | Estrategia digital | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Evaluación de madurez digital | Estrategia digital | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Taller de oportunidades digitales | Estrategia digital | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Blueprint de estrategia digital | Estrategia digital | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Análisis de construir vs. comprar | Estrategia tecnológica | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Caso de inversión en deuda técnica | Estrategia tecnológica | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Blueprint de estrategia tecnológica | Estrategia tecnológica | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Sprint de estrategia tecnológica | Estrategia tecnológica | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Hoja de ruta de TI (12-24 meses) | Hoja de ruta de TI | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Sprint de hoja de ruta de TI | Hoja de ruta de TI | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Actualización trimestral de la hoja de ruta | Hoja de ruta de TI | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |

### Producto

| Servicio | Categoría | Modalidad propuesta | Precio (USD) | Horas de agente (est.) | Costo de agentes | Margen objetivo |
|---|---|---|---|---|---|---|
| Taller de descubrimiento | Descubrimiento de producto | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Evaluación de oportunidad y viabilidad | Descubrimiento de producto | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Sprint de descubrimiento de producto | Descubrimiento de producto | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Experimentos de validación de producto | Descubrimiento de producto | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Paquete de definición de producto | Definición de producto | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Requisitos de producto y backlog | Definición de producto | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Taller de visión y alcance de producto | Definición de producto | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Especificación técnica de producto | Definición de producto | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Taller de definición de alcance del MVP | Estrategia de MVP | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Estrategia y hoja de ruta del MVP | Estrategia de MVP | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Revisión de preparación para construir el MVP | Estrategia de MVP | Precio fijo, anticipo al inicio | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Director de producto fraccional | Gestión de producto | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Product Manager fraccional | Gestión de producto | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Asesoría de producto (ligera) | Gestión de producto | Retainer mensual | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
| Diseño del modelo operativo de producto | Gestión de producto | Precio fijo por hitos | [pendiente] | [pendiente] | [pendiente] | [pendiente] |
