"use server";

import { messageOf, isUuid } from "@/lib/action-helpers";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

export type SaveResult = { ok: boolean; message: string; savedAt?: string };

const LANGS = ["es", "en", "fr", "pt"];

/** Crea un borrador vacío y abre el editor. */
export async function createArticleAction(): Promise<void> {
  const created = await apiFetch<{ id: string }>("/articles", { method: "POST", body: { title: "Sin título", langs: ["es"] } });
  revalidatePath("/insights");
  redirect(`/insights/${created.id}`);
}

export type ArticleSaveInput = {
  id: string;
  lang: string;
  title: string;
  subtitle: string;
  body: Record<string, unknown>;
  excerpt: string;
  caseRef: string;
};

/**
 * Guarda el idioma que se está escribiendo, junto con el resumen y el caso.
 * Lo llama el editor con autoguardado: no navega ni recarga.
 */
export async function saveArticleContent(input: ArticleSaveInput): Promise<SaveResult> {
  if (!isUuid(input.id) || !LANGS.includes(input.lang)) return { ok: false, message: "Artículo no válido." };
  if (!input.title.trim()) return { ok: false, message: "El título no puede quedar vacío." };
  try {
    await apiFetch(`/articles/${input.id}`, {
      method: "PATCH",
      body: {
        excerpt: input.excerpt.trim() || null,
        caseRef: input.caseRef.trim() || null,
        content: {
          [input.lang]: {
            title: input.title.trim(),
            ...(input.subtitle.trim() ? { subtitle: input.subtitle.trim() } : {}),
            body: input.body,
          },
        },
      },
    });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  return { ok: true, message: "Guardado", savedAt: new Date().toISOString() };
}

/** Envía el artículo a revisión. La publicación se aprueba después en Aprobaciones. */
export async function sendArticleToReviewAction(id: string): Promise<SaveResult> {
  if (!isUuid(id)) return { ok: false, message: "Artículo no válido." };
  try {
    await apiFetch(`/articles/${id}/review`, { method: "POST" });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath(`/insights/${id}`);
  revalidatePath("/insights");
  return { ok: true, message: "Enviado a revisión. Lo apruebas en Aprobaciones." };
}

/** Descarta el borrador y vuelve a la lista. */
export async function discardArticleAction(id: string): Promise<SaveResult> {
  if (!isUuid(id)) return { ok: false, message: "Artículo no válido." };
  try {
    await apiFetch(`/articles/${id}`, { method: "DELETE" });
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidatePath("/insights");
  redirect("/insights");
}
