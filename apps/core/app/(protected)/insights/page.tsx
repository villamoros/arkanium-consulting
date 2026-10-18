import Link from "next/link";
import { connection } from "next/server";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { createArticleAction } from "./actions";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type Status = "borrador" | "en_revision" | "publicado";
type Article = {
  id: string;
  title: string;
  excerpt: string | null;
  caseRef: string | null;
  langs: string[];
  status: Status;
  publishedAt: string | null;
  updatedAt: string;
};

const STATUS_LABEL: Record<Status, string> = { borrador: "Borrador", en_revision: "En revisión", publicado: "Publicado" };
const STATUS_BADGE: Record<Status, string> = { borrador: "b-idle", en_revision: "b-pospuesto", publicado: "b-convertido" };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado = "" } = await searchParams;

  let articles: Article[];
  try {
    ({ articles } = await apiFetch<{ articles: Article[] }>("/articles"));
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar los artículos.";
    return (
      <StatePanel title="No pudimos cargar Insights">
        <p>{message}</p>
        <p>Ningún artículo se ha publicado ni modificado.</p>
      </StatePanel>
    );
  }

  // Depende de cuándo se atiende la petición: connection() lo marca como dinámico.
  await connection();
  const filtered = articles.filter((article) => !estado || article.status === estado);
  const count = (status: Status) => articles.filter((article) => article.status === status).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <p>Artículos del blog en los idiomas que escribas. Cada artículo se publica con su caso relacionado.</p>
        </div>
        <form action={createArticleAction}>
          <button type="submit" className="primary">Nuevo artículo</button>
        </form>
      </div>

      <div className="kpis" aria-label="Resumen de Insights">
        <div className="kpi">
          <b>{count("borrador")}</b>
          <span>en borrador</span>
        </div>
        <div className="kpi">
          <b>{count("en_revision")}</b>
          <span>en revisión</span>
        </div>
        <div className="kpi">
          <b>{count("publicado")}</b>
          <span>publicados</span>
        </div>
        <div className="kpi">
          <b>{articles.filter((article) => !article.caseRef).length}</b>
          <span>sin caso relacionado</span>
        </div>
      </div>

      <div className="approval" role="note">
        <span aria-hidden="true">◈</span>
        <div>
          <strong>Publicar en el sitio es una salida externa:</strong> pasa por Aprobaciones. Nada sale al sitio hasta que lo apruebes.
        </div>
      </div>

      <form className="filters" method="get" role="search">
        <label className="sr" htmlFor="f-estado">Estado</label>
        <select id="f-estado" name="estado" defaultValue={estado}>
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="en_revision">En revisión</option>
          <option value="publicado">Publicado</option>
        </select>
        <button type="submit" className="secondary">Filtrar</button>
      </form>

      <section className="panel" aria-label="Artículos">
        {filtered.length === 0 ? (
          <p className="muted" style={{ padding: 18, margin: 0 }}>
            {articles.length === 0 ? "Todavía no hay artículos. Crea el primero: se abre directamente en el editor." : "No hay artículos con ese estado."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Artículo</th>
                <th scope="col">Estado</th>
                <th scope="col" className="hide-sm">Idiomas</th>
                <th scope="col" className="hide-sm">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => (
                <tr key={article.id}>
                  <td>
                    <Link href={`/insights/${article.id}`} className="row-link">
                      <div className="lead-name">{article.title}</div>
                      <div className="sub">{article.caseRef ?? "Sin caso relacionado"}</div>
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[article.status]}`}>{STATUS_LABEL[article.status]}</span>
                  </td>
                  <td className="hide-sm">{article.langs.map((lang) => lang.toUpperCase()).join(" · ") || "—"}</td>
                  <td className="hide-sm sub">{formatDate(article.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
