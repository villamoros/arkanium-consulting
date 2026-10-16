# ARK-ARCH-001 — arquitectura y reglas de la plataforma

**Estado:** borrador vigente. Define el lenguaje común y las reglas que no cambian entre flujos. Los contratos por flujo (capa 3) se escriben después y deben respetar este documento.
**Fecha:** 2026-10-15.
**Alcance:** core (equipo Arkanium), app (clientes), control (operación y agentes) y la API que las conecta. El sitio público (`arkanium-web`) solo entrega leads.

---

## 1. Glosario

| Término | Qué es | Notas |
| --- | --- | --- |
| **Buyer persona** | Segmento de cliente ideal (perfil, sector, problema típico). | No es una cuenta de usuario. |
| **Campaña** | Esfuerzo de mercadeo y publicidad que atrae interesados. | Antes llamada «engagement» en conversaciones; ese nombre queda reservado para el servicio contratado en el código. |
| **Lead** | Persona u organización interesada, captada por una campaña o por el sitio. | Puede agendar una reunión demo. |
| **Contacto** | Persona concreta asociada a un lead o a una organización. | Es la persona física, no el segmento. |
| **Organización** | Empresa cliente de Arkanium. Corresponde a una organización de Clerk. | Se crea al convertir el lead. Es la frontera de aislamiento principal. |
| **Proyecto** | Servicio contratado por una organización. Tiene alcance, precio, hitos y su equipo de agentes. | Es el único contenedor de trabajo del cliente. |
| **Tarea** | Actividad del Arkanium Framework dentro de un proyecto. | Ejecutada por personas o agentes, según el caso. |
| **Entregable** | Resultado de una tarea que se muestra al cliente: avance, informe preliminar, informe final. | Pasa por publicación antes de ser visible. |
| **Reunión** | Encuentro entre el owner y un contacto: demo, cierre, avance o cierre de proyecto. | Siempre aprobada por el owner. |
| **Equipo de agentes** | Conjunto de agentes asignados a un proyecto, con herramientas y permisos acotados. | Vive en control. |
| **Manual de caso** | Conocimiento que el equipo de agentes construye para un proyecto. | Propiedad intelectual de Arkanium. Nunca sale a clientes. |

Relación principal: **Buyer persona → Campaña → Lead → Organización → Proyecto → Tareas → Entregables**. Las reuniones se conectan al lead, a la organización o al proyecto según su tipo.

## 2. Entidades y relaciones

- Una **organización** tiene uno o varios **proyectos**. Un proyecto pertenece a una sola organización.
- Un **lead** puede convertirse en una sola **organización**. Un lead que no se convierte se conserva para seguimiento.
- Una **campaña** atrae **leads** y se dirige a uno o varios **buyer personas**.
- Un **proyecto** tiene un **equipo de agentes**, **tareas**, **entregables**, **reuniones** y, en su caso, **facturación**.
- Un proyecto puede ser **contratado** o **interno**. Un proyecto interno es un diagnóstico que Arkanium hace sin que el cliente lo haya pedido, para tener un punto de partida. No se factura y sus resultados no cruzan a la app del cliente salvo que el owner los publique. Si el cliente luego contrata el servicio, el diagnóstico interno pasa a ser parte del proyecto contratado.
- El **manual de caso** pertenece a un proyecto, no a una organización: dos proyectos de la misma empresa tienen manuales separados.

## 3. Acceso

### 3.1 Roles en Clerk

Se usan solo dos roles, para todos los clientes:

| Rol | Quién | Puede |
| --- | --- | --- |
| `org:admin` | Persona que el owner designa en la organización del cliente | Ver todos los proyectos de su organización; aprobar entregables; gestionar miembros. |
| `org:member` | Personas autorizadas por el admin | Ver los proyectos a los que tiene acceso; dejar comentarios y correcciones. |

No se crean roles por organigrama de cada cliente.

En la organización interna de Arkanium se usan los mismos roles. El **owner** es `org:admin`. Quien opera el equipo de Arkanium tiene acceso a core, y el acceso a control se limita a administradores.

### 3.2 Acceso fino por proyecto

El acceso a cada proyecto lo decide la base de datos, no Clerk. Una persona de un cliente solo ve los proyectos a los que fue asignada explícitamente, aunque sea miembro de la organización.

### 3.3 Invitaciones

- **Solo el owner invita.** Las invitaciones se hacen desde core, nunca por autoservicio desde el sitio o la app.
- Un admin de cliente puede proponer nuevos miembros, pero la invitación final la envía el owner.
- Retirar a una persona de una organización también lo hace el owner.

### 3.4 Reglas que aplican siempre

- La autorización se decide en la API, en cada petición, con el token verificado en servidor.
- Una persona nunca ve datos de otra organización, ni por URL ni por parámetros.
- Los agentes solo actúan dentro del proyecto para el que fueron asignados.

## 4. Frontera con el cliente

### 4.1 Lo que cruza

Solo cruzan a la app del cliente, tras publicación:
- **Avances** del proyecto.
- **Informe preliminar.**
- **Correcciones** que el cliente deja sobre el informe.
- **Informe final.**
- **Reuniones y su acta.** Toda reunión tiene acta, y el cliente puede verla igual que el equipo de Arkanium.
- **Facturas completas** de sus proyectos, con su estado de pago.

### 4.2 Lo que nunca cruza

- El Arkanium Framework: ni su estructura, ni sus plantillas, ni su lógica.
- El manual de caso.
- La operación de los agentes: prompts, herramientas, decisiones internas y registros de ejecución.
- Datos de otros clientes o de otros proyectos.
- Notas internas del owner sobre el cliente.

### 4.3 Publicación

Ningún contenido llega a un cliente sin pasar por publicación:

1. Un agente o miembro del equipo **redacta** el entregable en control o core.
2. El owner **revisa** y aprueba o devuelve.
3. Al aprobar, el entregable se **publica** en la app del proyecto.
4. Si el cliente deja correcciones, vuelven a control para su revisión, no se aplican directamente.

Esto cumple la regla de que los agentes no escriben al cliente sin aprobación.

## 5. Operación de la empresa

Arkanium se opera con agentes de IA. La estructura es:

- **Equipos de agentes por proyecto.** Cada proyecto tiene su equipo, con herramientas y permisos acotados a ese proyecto.
- **Agentes de operación interna.** Atienden finanzas, administración y seguimiento de la empresa.
- **Agentes de desarrollo.** Son los equipos de TI que construyen y mantienen los proyectos del cliente, siempre dentro de su alcance.

Ningún agente cambia estados comerciales, precios ni acuerdos sin aprobación del owner.

## 6. Cobro

Modelo propuesto, por confirmar con un contador en Estados Unidos. Se decide por tipo de proyecto:

| Tipo | Cobro | Implementación en Stripe |
| --- | --- | --- |
| Diagnóstico o evaluación | Precio fijo, con anticipo al inicio | Checkout para el anticipo; factura final |
| Implementación | Precio fijo por hitos | Invoices, una por hito aprobado |
| Servicio continuo (p. ej. CTO fraccionado) | Retainer mensual | Subscriptions |
| Alcance no definido | Tiempo y materiales, con tope | Invoices periódicas con límite |

Reglas:
- Ningún dato de tarjeta pasa por nuestros sistemas. El cobro ocurre en Stripe.
- Stripe avisa a la API por webhook. La API es la única que registra el estado de pago.
- Un hito no se factura hasta que el owner lo aprueba como entregable.
- Impuestos sobre ventas según el estado de cada cliente; se configura con Stripe Tax después de que el contador lo confirme.

## 7. Qué queda fuera de este documento

- Mapa de flujos por persona (capa 2).
- Contratos por flujo, con endpoints, pantallas y pruebas (capa 3).
- Elección del proveedor de IA.
- Detalles de Stripe Connect, si en algún momento se cobran servicios a través de terceros.

## 8. Decisiones confirmadas

| # | Decisión |
| --- | --- |
| D-01 | Nombres: Buyer persona, Campaña, Lead, Contacto, Organización, Proyecto, Tarea, Entregable, Reunión, Equipo de agentes, Manual de caso. |
| D-02 | Roles de Clerk: solo `org:admin` y `org:member`, iguales para todos los clientes. |
| D-03 | Las invitaciones y retiros de personas los hace el owner desde core. |
| D-04 | Lo que cruza al cliente es avance, informe preliminar, correcciones, informe final, reuniones y estado de pagos. |
| D-05 | Ningún contenido llega al cliente sin publicación aprobada por el owner. |
| D-06 | El cobro sigue el modelo de la sección 6, por confirmar con contador. |
| D-07 | Stripe procesa todos los pagos. La API recibe los eventos por webhook. |
| D-08 | Un proyecto puede ser contratado o interno. Los internos no se facturan y no cruzan al cliente sin publicación. |
| D-09 | El cliente ve la factura completa de cada proyecto, no solo el estado de pago. |
| D-10 | El owner decide qué reuniones se documentan. Toda reunión documentada tiene acta visible para el cliente. |

## 9. Preguntas abiertas

Ninguna por ahora. Las preguntas anteriores quedaron resueltas en D-08, D-09 y D-10.

## 10. Excepción vigente: biblioteca de casos

La sección 2 dice que el manual de un proyecto pertenece a ese proyecto y no se reutiliza entre clientes. Esto sigue siendo cierto para el **trabajo en curso**. La excepción aplica a los **casos cerrados**: los agentes de nuevos proyectos pueden consultar la ficha completa de casos previos en modo de lectura, para aprender cómo trabaja Arkanium. Detalle en ARK-ARCH-003, sección 5, y ARK-FW-001, sección 7.

Queda pendiente la confirmación legal de que los contratos permiten ese uso interno (D-11). Hasta confirmarla, la biblioteca no se construye.
