import Link from "next/link";
import { notFound } from "next/navigation";
import type { Lead } from "@arkanium/contracts";
import { ApiError, apiFetch } from "@/lib/api";
import { EditLeadForm } from "@/components/leads/edit-lead-form";
import { StatePanel } from "@/components/state-panel";

// instant = false: la página lee la API con la sesión del visitante; la guía de Next lo recomienda para rutas así.
export const instant = false;

// Edición de los datos de un lead. Un lead convertido se edita desde su organización.
export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let lead: Lead;
  try {
    lead = await apiFetch<Lead>(`/leads/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    const message = error instanceof ApiError ? error.message : "No pudimos cargar este lead.";
    return (
      <StatePanel title="No pudimos cargar este lead">
        <p>{message}</p>
      </StatePanel>
    );
  }

  return (
    <>
      <Link href={`/leads/${lead.id}`} className="sub" style={{ display: "inline-block", marginBottom: 10 }}>
        ← {lead.name}
      </Link>
      <div className="page-head">
        <div>
          <h1>Editar lead</h1>
          <p>Cambia los datos de contacto, el origen o las notas. Queda registrado en la bitácora.</p>
        </div>
      </div>

      <section className="panel pad">
        {lead.status === "convertido" ? (
          <p className="sub" style={{ marginTop: 0 }}>
            Este lead ya es una organización. Solo puedes cambiar nombre y correo: se actualizan también en el contacto principal del cliente. El resto queda como historial del lead.
          </p>
        ) : null}
        <EditLeadForm lead={lead} contactOnly={lead.status === "convertido"} />
      </section>
    </>
  );
}
