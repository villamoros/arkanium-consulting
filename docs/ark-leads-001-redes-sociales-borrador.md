# ARK-LEADS-001 — Conexión de leads con redes sociales (borrador)

**Estado:** borrador. No implementado. Sirve para decidir antes de construir.
**Fecha:** 2026-10-16.

## 1. Objetivo

Que cada persona que se interesa por Arkanium desde una red social aparezca en **Leads** de core, con su origen, sin perder el control de contacto que define la política de buyer personas.

## 2. Vías de entrada

| Vía | Cómo llega | Estado |
| --- | --- | --- |
| Formulario de landing de campaña | La persona llena el formulario de una landing enlazada desde un anuncio o publicación. La landing envía el lead a la API con su origen. | Pendiente: las landing pages no existen aún (quedan para después). |
| Formulario del sitio (blog, cierre) | Hoy llega por correo a `hello@` (registro oficial) y, al configurar el token, también a la API con origen `website`. | Activo tras configurar `ARKANIUM_API_URL` y `LEAD_INTAKE_TOKEN` en Cloudflare. |
| Mensaje directo o comentario | No hay formulario. Alguien del equipo registra el lead a mano en core con origen y referencia del perfil. | Alta manual disponible en core. |
| Referido o evento | Igual que el mensaje directo, con origen `referido` o `evento`. | Alta manual disponible. |
| Lead de una red con formulario nativo (por ejemplo, formularios de anuncios de LinkedIn o Meta) | Requiere integración con la plataforma de anuncios. | Por investigar; ver §5. |

## 3. Datos que se guardan

- **`source`:** la red o el canal (`linkedin`, `instagram`, `facebook`, `tiktok`, `youtube`, `x`, `mensaje-directo`, `referido`, `evento`, `website`, `otro`).
- **`sourceReference`:** el perfil o enlace de origen (por ejemplo, el usuario de la red). Es un dato personal: se trata con la misma regla que el resto de los datos de contacto.
- **Campaña:** la columna `campaign_id` ya existe. Se llena cuando haya campañas registradas en la plataforma.
- **Buyer persona:** la columna `buyer_persona_id` ya existe. Se llena al segmentar el lead.

## 4. Reglas que aplican

1. **Política de contacto (ARK-ARCH / buyer personas):** máximo 10 contactos al día en total, sin envíos masivos. Un lead creado a partir de un contacto directo cuenta contra ese tope.
2. **Consentimiento y supresión:** toda persona que pida no ser contactada entra en la lista de supresión (pantalla de core) y ningún canal la vuelve a contactar. Esta regla está pendiente de revisión legal.
3. **Ningún agente contacta sin aprobación:** los mensajes salen solo con tu aprobación, igual que cualquier salida externa.
4. **Un lead convertido** ya tiene organización: su origen se conserva, pero no se edita desde Leads.

## 5. Preguntas abiertas

1. **Integración con plataformas:** LinkedIn, Meta, TikTok, YouTube y X tienen condiciones de API y de datos distintas. Antes de integrar, hay que revisar qué permite cada una y con qué costo. No se asume ninguna por ahora.
2. **Automatización de mensajes directos:** sin integración oficial, la captura de mensajes sigue siendo manual. Automatizar el envío de mensajes en redes puede violar sus términos; eso requiere revisión del abogado antes de cualquier intento.
3. **Atribución de campañas:** cómo asociar un lead con la publicación o anuncio exacto (parámetros de seguimiento en los enlaces de cada landing).
4. **Quién registra los leads manuales:** el owner, o también un agente de marketing con aprobación previa.

## 6. Siguiente paso propuesto

Cuando las landing pages estén listas, enviar desde cada una el campo `source` y un parámetro de campaña. Después, revisar las condiciones de cada red antes de integrar cualquier formulario nativo.
