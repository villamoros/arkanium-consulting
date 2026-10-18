import { notFound } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { StatePanel } from "@/components/state-panel";
import { ArticleEditor, type EditorArticle } from "@/components/insights/article-editor";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

export default async function ArticleEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let article: EditorArticle;
  try {
    article = await apiFetch<EditorArticle>(`/articles/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    const message = error instanceof ApiError ? error.message : "No pudimos abrir el artículo.";
    return (
      <StatePanel title="No pudimos abrir el artículo">
        <p>{message}</p>
        <p>Nada se ha modificado.</p>
      </StatePanel>
    );
  }

  return <ArticleEditor key={article.id} article={article} />;
}
