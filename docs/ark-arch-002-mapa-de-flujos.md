# ARK-ARCH-002 — mapa de flujos

**Estado:** borrador. Capa 2 de la arquitectura. Parte de ARK-ARCH-001 (glosario, roles, frontera y cobro) y no lo contradice.
**Fecha:** 2026-10-15.

Un flujo es una secuencia que una persona o un agente completa para lograr algo. Cada flujo indica quién lo inicia, qué pasos tiene, dónde se necesita aprobación del owner y si algo cruza al cliente. Los contratos (capa 3) detallarán endpoints, pantallas y pruebas de cada flujo marcado como prioritario.

**Regla transversal:** ninguna acción con efecto externo (correo, reunión, factura, publicación) ocurre sin aprobación del owner. Los agentes preparan; el owner decide.

---

## 1. Sitio público (`arkanium-web`)

| ID | Flujo | Inicio | Pasos | Aprobación | Cruza al cliente |
| --- | --- | --- | --- | --- | --- |
| **F-01** | Captar lead desde el formulario | Visitante llena el formulario | Validación → se crea el lead en core → aviso al owner | No | No |

## 2. Core (equipo Arkanium, `core.arkanium.consulting`)

Core es el lugar donde el owner y el equipo ven el negocio: leads, reuniones, clientes, contenido y facturación.

| ID | Flujo | Inicio | Pasos | Aprobación | Cruza al cliente |
| --- | --- | --- | --- | --- | --- |
| **F-02** | Calificar lead | Lead nuevo (F-01 o campaña) | Un agente de captación resume el lead y propone prioridad y siguiente paso → el owner confirma, descarta o pospone | Owner | No |
| **F-03** | Agendar reunión demo | Lead calificado pide o acepta una reunión | Solicitud → propuesta de horario → el owner aprueba → se crea la reunión → se envía la invitación | Owner | Sí, la invitación al contacto |
| **F-04** | Convertir lead en organización | Reunión demo o propuesta aceptada | El owner confirma la conversión → se crea la organización (y su correspondencia en Clerk) → se registra el contacto principal | Owner | No |
| **F-05** | Crear proyecto | Organización con servicio acordado | Se define alcance, precio y tipo de cobro (sección 6 de ARK-ARCH-001) → se crea el proyecto contratado o interno → se asigna su equipo de agentes | Owner | No, hasta que el owner publique el proyecto al cliente |
| **F-06** | Invitar o retirar miembros de una organización | Admin del cliente propone, o el owner decide | El admin propone una persona → el owner aprueba y envía la invitación con su rol → o el owner retira a una persona | Owner | Sí, la invitación |
| **F-07** | Gestionar campañas y buyer personas | Plan de mercadeo | Definir buyer persona → crear campaña → revisar leads que atrae | Owner (inicio de campaña) | No |
| **F-08** | Revisar y publicar entregable | Agente o equipo termina un entregable | Redacción en control → revisión → el owner aprueba, devuelve o publica → aparece en la app del proyecto | Owner | Sí, tras publicar |
| **F-09** | Documentar reunión (acta) | Reunión realizada | Agente redacta el acta → el owner revisa → se publica al cliente y al equipo | Owner | Sí, tras publicar |
| **F-10** | Emitir factura | Hito aprobado, anticipo, o ciclo de retainer | Factura creada en Stripe a partir del proyecto → el owner la aprueba → se envía | Owner | Sí, la factura completa |
| **F-11** | Publicar contenido de Insights | Artículo o caso listo | Redacción → revisión → publicación en el sitio | Owner | No, es público |

## 3. App (clientes, `app.arkanium.consulting`)

El cliente solo ve lo que el owner publicó. Su app no muestra nada interno.

| ID | Flujo | Inicio | Pasos | Aprobación | Cruza al cliente |
| --- | --- | --- | --- | --- | --- |
| **A-01** | Entrar a su organización | Inicio de sesión desde el sitio | Clerk autentica → la API decide el destino → se activa su organización → entra a la app | No | — |
| **A-02** | Ver sus proyectos y su estado | Entrada a la app | Lista de sus proyectos (solo los asignados a esa persona) → detalle con avance y próximos pasos publicados | No | Ya es el contenido |
| **A-03** | Ver entregables y dejar correcciones | Entregable publicado | Ver el entregable → comentar o pedir cambios → la corrección llega a control para revisión | No (la corrección entra a revisión) | Sí, la corrección vuelve a Arkanium |
| **A-04** | Solicitar reunión | El cliente necesita hablar | Elige un motivo y un horario sugerido → queda como solicitud pendiente | Owner (aprueba la reunión, F-03) | Sí, la solicitud |
| **A-05** | Ver reuniones y actas | Reunión realizada | Lista de reuniones → acta de cada una | No | Ya es el contenido |
| **A-06** | Ver y pagar facturas | Factura publicada | Lista de facturas completas → pago en la página de Stripe → estado actualizado por webhook | No | Ya es el contenido |
| **A-07** | Proponer un miembro | Admin del cliente quiere añadir a alguien | Escribe nombre y correo → la propuesta llega al owner (F-06) | Owner | Solo la confirmación |

## 4. Control (operación y agentes, privado)

Control es donde trabajan los agentes y donde el owner supervisa la operación. Nada de lo que hay aquí llega al cliente, salvo que el owner lo publique desde core.

| ID | Flujo | Inicio | Pasos | Aprobación | Cruza al cliente |
| --- | --- | --- | --- | --- | --- |
| **C-01** | Armar el equipo de agentes de un proyecto | Proyecto creado (F-05) | Se asignan agentes y herramientas → se fijan permisos acotados al proyecto | Owner | No |
| **C-02** | Ejecutar las tareas del framework | Tarea asignada a un agente | El agente trabaja dentro de su proyecto → registra cada paso → entrega un borrador o un resultado | No (las salidas externas pasan por F-08) | No |
| **C-03** | Cola de aprobaciones | Un agente necesita decidir algo con efecto externo | Propuesta en cola → el owner aprueba, rechaza o pide cambios | Owner | Depende de la acción |
| **C-04** | Operación financiera interna | Pagos de Stripe, facturas, gastos | Conciliación de pagos → alertas de vencimientos → reportes para el owner | Owner (acciones que muevan dinero) | No |
| **C-05** | Desarrollo de proyectos por equipos de TI de agentes | Alcance de un proyecto técnico aprobado | Planear, construir y probar dentro del alcance → entregar a revisión | Owner (cierre de cada entrega) | No, hasta publicar |
| **C-06** | Construir y consultar el manual de caso | Durante cualquier tarea del proyecto | El agente escribe lo aprendido y lo consulta antes de actuar | No | Nunca |
| **C-07** | Bitácora y trazabilidad | Cualquier ejecución | Cada acción queda registrada con entrada, herramientas, aprobaciones y resultado | No | Nunca |

---

## 5. Prioridad para la capa 3

No se construye todo a la vez. El primer contrato debe cerrar un camino completo, de punta a punta:

1. **Primer contrato: F-01 → F-02 → F-04.** Un lead llega desde el sitio, se califica y se convierte en organización. Es el flujo que más valor tiene y el que ya empieza en el sitio. Exige: modelo de leads y organizaciones, la API con permisos y la pantalla de leads en core.
2. **Segundo contrato: F-05 → A-02 → F-08 → A-03.** Un proyecto se crea, se publica un entregable y el cliente lo ve y deja una corrección. Es el ciclo que demuestra el valor para el cliente.
3. **Tercer contrato: F-03 → A-04 → F-09 → A-05.** Reuniones con aprobación y acta.
4. **Cuarto contrato: F-10 → A-06.** Facturación con Stripe, después de tener proyectos y reuniones reales.

Los flujos de control (C-01 a C-07) se van construyendo a medida que los flujos de core y app los necesitan. No tiene sentido construir una operación completa de agentes antes de tener algo que operar.

## 6. Preguntas abiertas

1. **F-02:** ¿el owner quiere que el agente de captación califique automáticamente, o solo que proponga y el owner decida siempre?
2. **C-05:** ¿los equipos de TI de agentes desarrollan código para los clientes, o solo entregan análisis y documentación?
3. **F-08:** ¿un entregable necesita una revisión del owner por cada cambio, o solo al final de cada fase?
