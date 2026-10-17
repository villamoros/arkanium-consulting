import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { StatePanel } from "@/components/state-panel";
import { SuppressionForm } from "@/components/suppression/suppression-form";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

type Suppression = { id: string; email: string; reason: string; createdBy: string; createdAt: string };

export default async function SuppressionPage() {
  let suppressions: Suppression[];
  try {
    ({ suppressions } = await apiFetch<{ suppressions: Suppression[] }>("/suppressions"));
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "No pudimos cargar la lista de supresión.";
    return (
      <StatePanel title="No pudimos cargar la lista de supresión">
        <p>{message}</p>
      </StatePanel>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Supresión y consentimiento</h1>
          <p>Correos que no deben recibir ningún contacto de Arkanium. Se revisa antes de cada invitación.</p>
        </div>
      </div>

      <section className="panel pad" aria-labelledby="nueva-supresion">
        <h2 id="nueva-supresion" style={{ fontSize: "1rem" }}>
          Añadir un correo
        </h2>
        <SuppressionForm />
      </section>

      <section className="section" aria-labelledby="lista-supresion">
        <h3 id="lista-supresion">Correos suprimidos</h3>
        {suppressions.length === 0 ? (
          <p className="muted">Todavía no hay correos suprimidos.</p>
        ) : (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Correo</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Añadido</th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map((item) => (
                  <tr key={item.id}>
                    <td>{item.email}</td>
                    <td>{item.reason}</td>
                    <td className="sub">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
