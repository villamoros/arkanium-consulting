"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

export type MarketingActionState = { ok: boolean; message: string } | null;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function optional(value: string): string | undefined {
  return value ? value : undefined;
}

/**
 * Una sola acción para el módulo de mercadeo. El tipo de operación decide la ruta y el cuerpo.
 * Las validaciones de forma viven en la API (contratos); aquí solo se arma la petición.
 */
export async function marketingAction(_previous: MarketingActionState, formData: FormData): Promise<MarketingActionState> {
  const op = text(formData, "op");
  const id = text(formData, "id");
  if (id && !isUuid(id)) return { ok: false, message: "Elemento no válido." };

  let method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST";
  let path = "";
  let body: unknown;
  let message = "Guardado.";
  let revalidate = ["/campanas", "/perfiles", "/insights"];

  switch (op) {
    case "campaign-create":
      path = "/campaigns";
      body = { name: text(formData, "name"), service: text(formData, "service"), buyerPersonaId: optional(text(formData, "buyerPersonaId")) };
      message = "Campaña creada.";
      break;
    case "campaign-status":
      method = "PATCH";
      path = `/campaigns/${id}`;
      body = { status: text(formData, "status") };
      message = "Estado de la campaña actualizado.";
      break;
    case "landing-create":
      path = "/landing-pages";
      body = { title: text(formData, "title"), url: optional(text(formData, "url")), campaignId: optional(text(formData, "campaignId")) };
      message = "Landing page creada.";
      break;
    case "landing-assign":
      method = "PATCH";
      path = `/landing-pages/${id}`;
      body = { campaignId: text(formData, "campaignId") || null };
      message = "Landing page asignada.";
      break;
    case "persona-create":
      path = "/buyer-personas";
      body = {
        name: text(formData, "name"),
        segment: text(formData, "segment"),
        service: text(formData, "service"),
        channel: text(formData, "channel"),
        note: optional(text(formData, "note")),
      };
      message = "Perfil creado.";
      break;
    case "persona-status":
      method = "PATCH";
      path = `/buyer-personas/${id}`;
      body = { status: text(formData, "status") };
      message = text(formData, "status") === "pausado" ? "Perfil en pausa. No recibe contactos." : "Perfil reanudado.";
      revalidate = ["/perfiles"];
      break;
    case "persona-delete":
      method = "DELETE";
      path = `/buyer-personas/${id}`;
      message = "Perfil eliminado. Sus contactos quedan en la bitácora.";
      revalidate = ["/perfiles"];
      break;
    case "contact-create":
      path = `/buyer-personas/${id}/contacts`;
      body = { channel: text(formData, "channel"), note: text(formData, "note") };
      message = "Contacto registrado.";
      revalidate = ["/perfiles"];
      break;
    case "persona-convert":
      path = `/buyer-personas/${id}/convert`;
      body = { name: text(formData, "name"), email: text(formData, "email"), company: optional(text(formData, "company")) };
      message = "Perfil pasado a Leads.";
      revalidate = ["/perfiles", "/leads"];
      break;
    case "article-create":
      path = "/articles";
      body = {
        title: text(formData, "title"),
        excerpt: optional(text(formData, "excerpt")),
        caseRef: optional(text(formData, "caseRef")),
        langs: formData.getAll("langs").map(String),
      };
      message = "Artículo creado como borrador.";
      break;
    case "article-update":
      method = "PATCH";
      path = `/articles/${id}`;
      body = {
        title: text(formData, "title"),
        excerpt: text(formData, "excerpt") || null,
        caseRef: text(formData, "caseRef") || null,
        langs: formData.getAll("langs").map(String),
      };
      message = "Artículo actualizado. Si estaba en revisión, vuelve a borrador.";
      break;
    case "article-review":
      path = `/articles/${id}/review`;
      message = "Artículo enviado a revisión. Su publicación se aprueba en Aprobaciones.";
      break;
    case "article-discard":
      method = "DELETE";
      path = `/articles/${id}`;
      message = "Borrador descartado.";
      break;
    case "brief-save": {
      const budget = text(formData, "budget").replace(",", ".");
      const budgetCents = budget ? Math.round(Number(budget) * 100) : null;
      method = "PUT";
      path = `/campaigns/${id}/brief`;
      body = {
        objective: text(formData, "objective"),
        message: text(formData, "message"),
        cta: text(formData, "cta"),
        constraints: optional(text(formData, "constraints")) ?? null,
        kpis: optional(text(formData, "kpis")) ?? null,
        budgetCents: budgetCents !== null && Number.isFinite(budgetCents) ? budgetCents : null,
        networks: formData.getAll("networks").map(String),
        personaIds: formData.getAll("personaIds").map(String),
      };
      message = "Brief guardado. Si estaba aprobado, vuelve a borrador.";
      break;
    }
    case "brief-review":
      path = `/campaigns/${id}/brief/review`;
      message = "Brief enviado a revisión. Lo apruebas en Aprobaciones.";
      break;
    case "piece-create":
      path = `/campaigns/${id}/pieces`;
      body = {
        network: text(formData, "network"),
        format: text(formData, "format"),
        copy: text(formData, "copy"),
        assetUrl: optional(text(formData, "assetUrl")),
      };
      message = "Pieza creada como borrador.";
      break;
    case "piece-review":
      path = `/campaign-pieces/${id}/review`;
      message = "Pieza enviada a revisión. La apruebas en Aprobaciones.";
      break;
    case "piece-discard":
      method = "DELETE";
      path = `/campaign-pieces/${id}`;
      message = "Pieza descartada.";
      break;
    default:
      return { ok: false, message: "Acción no válida." };
  }

  try {
    await apiFetch(path, { method, body });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  for (const route of revalidate) revalidatePath(route);
  return { ok: true, message };
}
