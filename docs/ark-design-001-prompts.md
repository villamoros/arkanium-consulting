# ARK-DESIGN-001 — prompts para diseño de la plataforma

**Estado:** borrador para uso con Claude Design. Cada prompt es independiente: copia el bloque base y el bloque de la superficie que quieras diseñar.
**Fecha:** 2026-10-15.
**Relación:** ARK-ARCH-001 (entidades y reglas), ARK-ARCH-002 (flujos), ARK-ARCH-003 (organigrama) y ARK-FW-001 (framework).

---

## Bloque base (copiar siempre)

```text
Diseña pantallas para una plataforma de consultoría de software operada por agentes de IA, llamada Arkanium.
Hay un único dueño humano (el owner) que aprueba todo lo que sale hacia un cliente. Los agentes trabajan dentro de un proyecto y nunca firman ni aprueban nada.

Identidad visual (tomada del sitio público, para mantener coherencia):
- Modo oscuro por defecto. Fondo principal #0b1220, superficies #101a2a y #1b2638, bordes con #d4a95a al 42% de opacidad.
- Acento dorado #d4a95a, dorado claro #f1d18b para énfasis.
- Texto principal #e6e8eb, texto secundario #b8c0cc.
- Títulos en Orbitron (h1 y h2 solamente). Texto en Exo 2.
- Tono sobrio y técnico. Sin ilustraciones decorativas. Sin emojis.
- Esquinas redondeadas de 6 a 8 px. Sombras profundas, sin brillos.

Requisitos de todas las pantallas:
- Textos en español como idioma principal. Dejar espacio para traducción al inglés, francés y portugués (los textos se alargan hasta un 30%).
- Accesibilidad: contraste AA mínimo, foco visible, navegación completa por teclado, estados de error y vacío explícitos.
- Responsive: escritorio y móvil (375 px). Sin scroll horizontal.
- Ninguna pantalla debe mostrar datos de otros clientes. Cada vista pertenece a una sola organización o a la organización interna.
- Cada acción que tenga efecto externo (enviar, publicar, facturar, agendar, invitar) debe mostrar claramente que requiere aprobación del owner, con su estado.

Entrega: pantallas con todos sus estados (vacío, cargando, error, éxito) y una nota corta con los componentes que se reutilizan.
```

## Superficie 1 — Sistema de diseño compartido

```text
Crea un sistema de diseño para tres aplicaciones (core, app y control) a partir del bloque base.

Incluye:
- Tokens de color (superficies, texto, acentos, estados de éxito, advertencia y error), tipografía, espaciado y radios.
- Componentes: botón (primario, secundario, fantasma, destructivo), campo de texto, selector, casilla, tabla con ordenación, tarjeta, badge de estado, pestañas, diálogo de confirmación, menú de usuario, barra lateral y encabezado de página.
- Badges de estado para: lead nuevo, calificado, descartado, reunión pendiente, reunión aprobada, entregable en revisión, publicado, factura pendiente, factura pagada, agente activo, agente pausado.
- Un componente de aviso de «acción requiere aprobación del owner», reutilizable.

Muestra el sistema en modo oscuro (principal) y en modo claro (secundario).
```

## Superficie 2 — Core (equipo Arkanium)

### 2.1 Bandeja de leads

```text
Pantalla de bandeja de leads para el owner de Arkanium.

Datos por lead: nombre, empresa, correo, buyer persona asignado, campaña de origen, fecha de captación, prioridad sugerida por el agente de calificación (con el motivo en una frase), estado (nuevo, calificado, descartado, reunión pendiente).

Acciones: calificar, descartar, posponer, agendar reunión, convertir en organización (esta última pide confirmación explícita).

Filtros: estado, campaña, buyer persona, prioridad. Orden por fecha y por prioridad.

Estados: sin leads nuevos, cargando, error al cargar.
```

### 2.2 Detalle de lead y conversión

```text
Pantalla de detalle de un lead.

Secciones: resumen del agente de calificación (propuesta de prioridad, motivo y siguiente paso sugerido), historial de contacto, contactos asociados, reuniones, notas internas del owner.

Acción principal: convertir en organización. Al pulsarla, muestra un diálogo que resume lo que se va a crear (organización, contacto principal, invitación pendiente) y exige confirmación. Después de convertir, muestra el estado de la invitación al contacto principal.

Nunca mostrar datos de otros leads.
```

### 2.3 Cola de aprobaciones

```text
Pantalla de cola de aprobaciones. Es la pantalla más importante del owner: aquí aprueba, devuelve o rechaza todo lo que los agentes proponen hacia el exterior.

Cada elemento muestra: tipo de acción (enviar correo, agendar reunión, publicar entregable, emitir factura, invitar miembro, publicar acta), agente que la propone, proyecto o lead al que pertenece, fecha, resumen de una línea, y vista previa completa del contenido que saldría.

Acciones: aprobar, devolver con comentario, rechazar. Cada decisión queda registrada.

Orden: por urgencia (fecha límite) y luego por antigüedad. Contador de pendientes siempre visible en la navegación.

Estados: cola vacía (con mensaje de que no hay nada que aprobar), cargando, error.
```

### 2.4 Proyectos y equipos de agentes

```text
Pantalla de proyectos de Arkanium, en dos vistas: lista de proyectos y detalle de proyecto.

Lista: nombre del proyecto, organización cliente, familia de servicio (Arquitectura, Estrategia o Producto), fase actual del framework (Evaluar, Arquitectar, Modernizar, Escalar), estado de las compuertas (G1 a G4), tipo de cobro, y si es contratado o interno.

Detalle: fases con sus compuertas, entregables de cada fase, tareas, el equipo de agentes asignado (con su estado) y la bitácora resumida. Acciones: asignar agente, avanzar compuerta (requiere aprobación), publicar entregable.

Un proyecto interno debe verse diferente del contratado (etiqueta clara, sin facturación).
```

### 2.5 Organigrama de agentes

```text
Pantalla que muestra el organigrama de Arkanium: áreas administrativas (dirección, ventas, mercadeo, operaciones comerciales, finanzas, legal y cumplimiento, administración, éxito del cliente), áreas transversales (PMO, calidad, biblioteca de casos, seguridad) y departamentos operativos (Arquitectura, Estrategia, Producto).

Cada área muestra su responsable humano y sus agentes. Cada agente muestra su servicio del catálogo, su estado (activo, pausado) y su costo de operación del mes.

Vista de un departamento: sus servicios y agentes, con indicador de margen por servicio.

Navegable por clic. Debe poder leerse de un vistazo en escritorio y en móvil con una vista de lista.
```

### 2.6 Contenido e Insights

```text
Pantalla para gestionar los artículos de Insights: lista con estado (borrador, en revisión, publicado), editor de texto enriquecido con vista previa en los cuatro idiomas, y selector de caso relacionado (obligatorio para publicar).

Flujo: borrador, enviar a revisión, aprobar o devolver. Un artículo publicado muestra su fecha y su enlace al sitio.
```

## Superficie 3 — App de clientes (app.arkanium.consulting)

El cliente solo ve lo que el owner publicó. Ninguna pantalla debe mostrar framework, manual de caso, agentes ni datos internos.

### 3.1 Inicio: mis proyectos

```text
Pantalla de inicio para una persona de un cliente. Muestra el nombre de la organización, su rol (Administrador o Miembro) y la lista de proyectos a los que tiene acceso.

Por proyecto: nombre, fase actual, próximo paso publicado, último avance, y número de entregables pendientes de revisión.

Si la persona no tiene proyectos asignados, muestra un mensaje claro que indica que debe pedirle acceso a su administrador.
```

### 3.2 Detalle de proyecto

```text
Pantalla de detalle de un proyecto del cliente.

Secciones:
- Avances publicados, en orden cronológico.
- Entregables: preliminar y final, con su estado (en revisión por Arkanium, listo para tu revisión, con correcciones, aprobado).
- Reuniones: próximas y pasadas, con acceso al acta.
- Facturas: lista completa de las facturas del proyecto, con monto, fecha, estado de pago y botón de pago que lleva a la página segura de Stripe.

Acciones: dejar comentario o corrección sobre un entregable, pedir una reunión (queda pendiente de aprobación de Arkanium).

Nada de esta pantalla debe sugerir que hay un agente trabajando.
```

### 3.3 Revisión de entregable

```text
Pantalla para revisar un entregable publicado (informe preliminar o final).

Muestra el documento completo con navegación por secciones, y un panel lateral para dejar correcciones por sección. Cada corrección indica que llegará a Arkanium para revisión, no que se aplicará automáticamente.

Estados: en revisión por Arkanium, listo para tu revisión, con correcciones enviadas, aprobado.

Si el cliente es Miembro y no tiene permiso para aprobar, el botón de aprobar no aparece y se explica por qué.
```

### 3.4 Reuniones y actas

```text
Pantalla de reuniones: próximas, pasadas y solicitudes pendientes.

Solicitud: motivo y horarios sugeridos. Estado visible (pendiente de aprobación, aprobada, rechazada con motivo).

Reunión pasada: acta completa, con los acuerdos, responsables y fechas. Acta visible para todos los participantes de la organización.
```

### 3.5 Facturas y pagos

```text
Pantalla de facturas de la organización, agrupadas por proyecto.

Por factura: número, concepto, monto, fecha de emisión, fecha de vencimiento, estado (pendiente, pagada, vencida) y botón de pagar cuando esté pendiente. Al pagar, se abre la página segura de Stripe; al volver, la factura muestra su estado actualizado.

No mostrar datos de tarjeta ni formularios de pago propios.
```

### 3.6 Sin acceso y sesión

```text
Dos estados de la app:
- Sin acceso: la persona inició sesión, pero su cuenta no tiene proyectos asignados. Mensaje claro, sin culpa, con la instrucción de pedir una invitación a su administrador y un botón para cerrar sesión.
- Menú de cuenta: nombre de la persona, organización activa con su rol, y botón de cerrar sesión.
```

## Superficie 4 — Control (privado)

Control es la consola operativa. Su público es el owner, y debe ser legible sin conocer la parte técnica.

### 4.1 Bitácora de agentes

```text
Pantalla de bitácora: la historia de cada acción de cada agente.

Cada entrada muestra: hora, agente, proyecto, tipo de acción, resultado (éxito, pendiente de aprobación, rechazado, error), y un resumen en lenguaje claro. Al abrir una entrada: entrada que recibió el agente, herramientas usadas, decisiones tomadas, casos de la biblioteca que consultó (con su identificador) y aprobaciones.

Filtros: agente, proyecto, resultado, rango de fechas. Búsqueda por texto.

Debe poder responder de un vistazo: qué hizo este agente hoy y qué quedó pendiente de mi aprobación.
```

### 4.2 Agente individual

```text
Ficha de un agente especialista. Muestra su departamento, su servicio del catálogo, sus entradas y salidas esperadas, sus herramientas permitidas, los proyectos a los que está asignado, su estado (activo, pausado), y su costo de operación del mes frente a los ingresos de su servicio.

Acciones: pausar, reanudar, asignar a proyecto (requiere aprobación). No se puede editar sus permisos desde esta pantalla: solo desde la configuración del departamento.
```

### 4.3 Framework y compuertas

```text
Pantalla del framework: las cuatro fases (Evaluar, Arquitectar, Modernizar, Escalar) con sus compuertas G1 a G4, sus criterios de salida y sus plantillas (PL-01 a PL-10).

Vista de un proyecto dentro del framework: qué compuertas ha cumplido, cuáles están pendientes y qué falta para cada una. Cada criterio se marca como cumplido, pendiente o en revisión, con evidencia enlazada.
```

## Cómo usar este documento

1. Empieza siempre con el bloque base.
2. Diseña primero el sistema de diseño (superficie 1). Las demás pantallas dependen de él.
3. Después core (leads y cola de aprobaciones son las dos más importantes), luego app y por último control.
4. Antes de pasar una pantalla a código, verifica que los datos que muestra existan en el contrato de su flujo (ARK-ARCH-002).
