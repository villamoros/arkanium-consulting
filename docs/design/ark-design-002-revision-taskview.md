# ARK-DESIGN-002 — revisión de TaskView y cambios a los dashboards

**Estado:** propuesta. Revisa las pantallas de ARK-DESIGN-001 antes de seguir con control.
**Fecha:** 2026-10-15.

## 1. Qué es TaskView y qué podemos usarle

TaskView (github.com/Gimanh/taskview-community) es una plataforma de gestión de proyectos y tareas. Su frontend usa Vue, Nuxt UI, Tailwind, Pinia, Chart.js, Vue Flow (diagramas), Tiptap (texto enriquecido), FullCalendar y Capacitor (apps móviles).

**Licencia: no se puede copiar su código para nuestro producto.** Según su README, es *source-available*, no open source. Permite el uso interno, la modificación y las integraciones internas. Prohíbe:
- ofrecerlo como servicio alojado (SaaS);
- venderlo como servicio;
- construir un producto comercial que compita con él;
- usar su nombre, logotipo o marca en productos derivados.

Nuestros dashboards son productos alojados que usan clientes externos, así que quedan en el área prohibida. No pude leer el archivo LICENSE completo (la ruta no respondió), así que esta conclusión se basa en el README. Antes de cualquier uso de código, un abogado debe leer ese archivo, y la alternativa legítima es pedir una licencia comercial al autor.

**Lo que sí podemos tomar: patrones de interfaz.** Las ideas de diseño no son código ni marca. Las aplicamos con nuestra identidad (Orbitron, Exo 2, oscuro, dorado) y con nuestros nombres.

## 2. Patrones que incorporamos

| Patrón | Dónde | Por qué |
| --- | --- | --- |
| Tablero por columnas (estados) | Core: tareas de cada proyecto por fase | Las tareas del framework se ven de un vistazo. |
| Calendario de reuniones | Core y app | Solicitudes y reuniones confirmadas en una sola vista. |
| Vista de hitos (línea de tiempo) | App | El cliente ve avances y entregas, sin tareas internas. |
| Gráficos de tendencia | Core: margen por familia | Permite decidir con datos (ARK-BIZ-001). |
| Editor de texto enriquecido | Core: actas y entregables | Redactar y revisar con formato, sin salir de la plataforma. |
| Vista de dependencias | Core, más adelante | Mostrar qué tarea bloquea a cuál. |

## 3. Cambios al dashboard de core (equipo Arkanium)

- **Barra superior con búsqueda global** (leads, clientes, proyectos) y contador de aprobaciones siempre visible.
- **Proyectos:** agregar vista de tablero por fase. Cada tarjeta muestra el agente asignado y su estado; no muestra cuánto cobra.
- **Reuniones:** agregar vista de calendario junto a la lista.
- **Nueva sección de analítica:** margen por familia y por servicio, con tendencia mensual. Sin cifras hasta que los agentes operen.
- **Actas e Insights:** editor de texto enriquecido con vista previa en los cuatro idiomas.

## 4. Cambios al dashboard del cliente (app)

- **Solo hitos y avances.** Las tareas internas, los agentes y el framework no aparecen, nunca. Esto cumple ARK-ARCH-001, sección 4.2.
- **Línea de tiempo** del proyecto con las entregas publicadas y las próximas.
- **Calendario** de reuniones con el acta enlazada.
- **Menos colores de estado:** el cliente ve solo tres: en curso, esperando tu respuesta y completado.

## 5. Lo que no cambia

- Nuestra identidad visual: tipografías del sitio, fondo oscuro y dorado.
- Los nombres del dominio: Proyecto, Organización, Entregable, Acta.
- La regla de aprobación: cualquier salida hacia fuera pasa por Aprobaciones.

## 6. Decisiones confirmadas

| # | Decisión |
| --- | --- |
| D-19 | Licencia de TaskView: se omite por ahora. El uso es interno y no se vende. Antes de publicar el tablero del cliente desde nuestro dominio, un abogado revisa la restricción de servicio alojado (el README la prohíbe). |
| D-20 | El margen por familia y por servicio lo ve solo el owner. Los agentes no acceden a esa analítica. |
| D-21 | El cliente ve los hitos publicados con su fecha prevista. Las fechas se marcan como previstas y se avisa cuando cambian. |
