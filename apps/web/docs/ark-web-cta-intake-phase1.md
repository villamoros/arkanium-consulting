# Contrato — Formulario del cierre: captación fase 1

**Estado:** implementado sin secretos. El envío real queda bloqueado hasta resolver B2 a B5 (ver §13).
**Fecha:** 2026-10-14.
**Alcance:** convertir el formulario de la sección de contacto (`src/components/sections/CTA.astro`) en un envío real: correo a `hello@arkanium.consulting` y alerta a Slack.
**Fuera de alcance:** agente de IA, chat, calendario, reservas, dashboard, analítica y proveedor de IA. Son fases posteriores con sus propios contratos.

---

## 1. Problema

Hoy el formulario valida y muestra «Solicitud recibida», pero **no envía nada**: el lead se pierde. Esto debe corregirse antes de publicar el sitio.

## 2. Decisiones ya tomadas

| Tema | Decisión |
| --- | --- |
| Registro oficial del lead | Correo a `hello@arkanium.consulting`. |
| Alerta interna | Slack (un solo canal de alertas para el owner). Solo alerta, no registro. |
| Aprobación de reuniones | Cada reunión la aprueba el owner. Ninguna se agenda sola. |
| Calendario (fase posterior) | Google Calendar. |
| Agente de IA | Fase posterior. Este contrato no lo incluye. |
| Opciones del formulario | Familias del catálogo (Estrategia, Producto, Arquitectura) y «no estoy seguro». Ya implementado. |

## 3. Pendientes bloqueantes

| # | Pendiente | Por qué bloquea | Quién |
| --- | --- | --- | --- |
| B1 | ~~Proveedor de hosting~~ **Resuelto: Cloudflare Pages.** El endpoint es una Pages Function en `functions/api/contact.ts`; no requiere adaptador de Astro. | — | — |
| B2 | **Proveedor de envío transaccional** para `hello@` (p. ej. Resend, Postmark o SES). | El correo sale desde un proveedor. Requiere verificar el dominio (SPF, DKIM). | Owner |
| B3 | **Webhook de Slack** del canal de alertas. | Sin él no hay alerta. Es un secreto: se guarda en el host, nunca en el repositorio. | Owner |
| B4 | **Texto de consentimiento** y enlace a la política de privacidad. | El formulario recoge datos personales. Debe revisarlo una persona con criterio legal. | Owner / legal |
| B5 | **Retención de leads** en el correo y en Slack. | Hay que definir cuánto tiempo se guardan. | Owner |

## 4. Flujo

```text
Visitante → formulario (CTA)
  → validación en navegador (ya existe)
  → POST /api/contact (endpoint del host)
      1. validación en servidor
      2. protección anti-spam
      3. envío de correo a hello@arkanium.consulting   ← registro oficial
      4. alerta a Slack                                  ← solo si el paso 3 funcionó
  → respuesta al navegador: éxito o error
```

El mensaje de éxito solo se muestra si el correo se envió. Si falla, el formulario conserva lo escrito y muestra un error con una alternativa de contacto.

## 5. Datos que se recogen

| Campo | Obligatorio | Validación |
| --- | --- | --- |
| Nombre | Sí | No vacío, máximo 120 caracteres. |
| Correo empresarial | Sí | Formato de correo, máximo 254 caracteres. |
| Prioridad | Sí | Uno de los valores permitidos: slug de familia o `unsure`. |
| Contexto | No | Máximo 2.000 caracteres. |
| Servicio y oferta (ocultos) | No | Si vienen de la URL (`?service=`), se validan contra el catálogo; si no existen, se descartan. |
| Consentimiento | Sí | Debe ser `true`. |
| Campo trampa (honeypot) | No | Debe llegar vacío. Si tiene valor, se descarta sin error visible. |

El servidor vuelve a validar todo. La validación del navegador no basta.

## 6. Contenido del correo

- **Asunto:** `[Lead] {prioridad} — {nombre}`.
- **Cuerpo:** nombre, correo, prioridad, servicio y oferta si existen, contexto, fecha y hora de recepción, idioma de la página.
- **Remitente:** dirección del dominio verificada, nunca el correo del visitante.
- **Respuesta (Reply-To):** el correo del visitante, para responder directo desde `hello@`.

## 7. Alerta en Slack

Mensaje corto al canal de alertas:

- Nombre, prioridad, idioma y hora.
- Correo del visitante.
- Primeras 200 caracteres del contexto.
- Enlace al hilo del correo, si el proveedor lo permite.

Slack recibe datos personales. Por eso el mensaje es mínimo y el registro completo queda en el correo.

## 8. Seguridad

- Endpoint solo acepta `POST` con `Content-Type: application/json` o formulario, y máximo 16 KB.
- Límite de envíos por IP (p. ej. 5 por hora). Valor a confirmar con el host.
- Protección anti-spam: campo trampa y, si el host lo ofrece, un desafío invisible. Nunca un CAPTCHA visible sin aprobación.
- Secretos (clave del proveedor de correo, webhook de Slack) solo como variables de entorno del host. Nunca en el repositorio ni en el navegador.
- No se registran datos personales en logs del host. Solo estado, idioma y motivo de error.
- Respuestas de error genéricas, sin detalles internos.

## 9. Criterios de aceptación

1. Un envío válido llega a `hello@` con todos los campos y `Reply-To` del visitante.
2. El mismo envío genera una alerta en Slack con el formato de la sección 7.
3. Si el correo falla, el formulario no muestra éxito y conserva los datos.
4. Si Slack falla pero el correo se envió, el lead no se pierde: se registra el error y el formulario muestra éxito.
5. Un envío sin consentimiento, con campos inválidos o con campo trampa lleno se rechaza.
6. Un envío que supera el límite por IP se rechaza con código 429.
7. Los secretos no aparecen en el repositorio, en el HTML ni en los logs.
8. Las cuatro versiones de idioma tienen el texto de consentimiento y los mensajes de error.
9. Pruebas automatizadas para validación, anti-spam y construcción del correo y de la alerta. Pruebas de integración contra el proveedor de correo y Slack en un entorno de prueba.

## 10. Entregables de implementación

- Endpoint `POST /api/contact` con validación y anti-spam.
- Módulo de correo y módulo de Slack, con pruebas.
- Casilla de consentimiento y enlace a privacidad en los cuatro idiomas.
- Ajuste del formulario para mostrar éxito, error y estado de envío.
- Documentación de variables de entorno (solo nombres, sin valores).

## 11. Riesgos

- **Entregabilidad del correo.** Sin verificar SPF y DKIM, los leads pueden caer en spam. Responsable: owner, en el DNS.
- **Mensaje sin respuesta.** El sitio promete respuesta en 24 horas hábiles. Hace falta alguien que revise `hello@`. Responsable: owner.
- **Spam.** Sin protección puede saturar la bandeja. Las medidas de la sección 8 lo reducen, no lo eliminan.
- **Dependencia del host.** El endpoint solo existe donde el host lo ejecuta. Cambiar de host implica adaptar el endpoint.

## 12. Siguiente paso

Con B1, B2, B3, B4 y B5 resueltos, se implementa este contrato. Mientras tanto, el formulario debe ocultar el mensaje de éxito o marcarse como no operativo antes de publicar el sitio.

## 13. Estado de implementación

**Implementado (sin secretos):**
- `src/lib/contact/lead.ts`: validación única (navegador y servidor). Prioridades = familias del catálogo + `unsure`; un test comprueba que coinciden con `content/services`.
- `src/lib/contact/compose.ts`: correo en texto plano y alerta de Slack con datos mínimos.
- `functions/api/contact.ts`: Pages Function. Orden: origen → tamaño → validación → correo → Slack. Sin configuración devuelve 503. Un correo fallido devuelve 502 y no avisa a Slack.
- `src/components/sections/CTA.astro`: envío real a `/api/contact`, casilla de consentimiento, campo trampa, estado de envío y mensaje de error. El éxito solo se muestra con respuesta 200.
- Textos de interfaz en los cuatro idiomas. **El texto del consentimiento es un borrador: requiere revisión legal (B4).**
- Pruebas: `npm run test:contact` (23 casos con `fetch` simulado).

**Variables de entorno en Cloudflare Pages (solo nombres):**
- `RESEND_API_KEY` (secreto) — proveedor de correo **propuesto**, pendiente de aprobación (B2).
- `LEAD_EMAIL_FROM` — remitente de un dominio verificado con SPF y DKIM.
- `LEAD_EMAIL_TO` — `hello@arkanium.consulting`.
- `SLACK_WEBHOOK_URL` (secreto) — webhook del canal de alertas (B3).

**Pendiente antes de publicar:**
1. B2: aprobar el proveedor de correo y verificar el dominio.
2. B3: crear el webhook de Slack y cargarlo como secreto.
3. B4: revisión legal del texto de consentimiento en los cuatro idiomas.
4. B5: plazo de retención de leads.
5. **Limitación de envíos.** El código no limita por IP: en un runtime sin estado no es fiable. Recomendado: regla de *Rate Limiting* de Cloudflare sobre `/api/contact` (owner) y/o Cloudflare Turnstile (requiere claves del owner).
6. Prueba de integración real contra el proveedor de correo y Slack en un entorno de prueba.
