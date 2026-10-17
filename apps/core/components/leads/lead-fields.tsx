import { leadSourceValues } from "@arkanium/contracts";
import { PRIORITY_LABEL, SOURCE_LABEL } from "@/lib/labels";

type Values = Partial<{
  name: string | null;
  email: string | null;
  company: string | null;
  priority: string | null;
  context: string | null;
  source: string | null;
  sourceReference: string | null;
}>;

/** Campos compartidos por el alta y la edición de un lead. Los valores iniciales vienen de la API. */
export function LeadFields({ values = {}, requireSource = true, contactOnly = false }: { values?: Values; requireSource?: boolean; contactOnly?: boolean }) {
  if (contactOnly) {
    // Lead convertido: solo nombre y correo, que siguen al contacto principal de la organización.
    return (
      <div className="filters" style={{ margin: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label className="field">
          Nombre
          <input name="name" required maxLength={120} defaultValue={values.name ?? ""} />
        </label>
        <label className="field">
          Correo
          <input name="email" type="email" required maxLength={254} defaultValue={values.email ?? ""} />
        </label>
      </div>
    );
  }
  return (
    <>
      <div className="filters" style={{ margin: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label className="field">
          Nombre
          <input name="name" required maxLength={120} defaultValue={values.name ?? ""} />
        </label>
        <label className="field">
          Correo
          <input name="email" type="email" required maxLength={254} defaultValue={values.email ?? ""} />
        </label>
        <label className="field">
          Empresa
          <input name="company" maxLength={160} defaultValue={values.company ?? ""} />
        </label>
        <label className="field">
          Interés
          <select name="priority" defaultValue={values.priority ?? "unsure"}>
            {Object.entries(PRIORITY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Origen
          <select name="source" required={requireSource} defaultValue={values.source ?? "mensaje-directo"}>
            {leadSourceValues.map((key) => (
              <option key={key} value={key}>
                {SOURCE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Perfil o enlace de origen
          <input name="sourceReference" maxLength={300} placeholder="Ej.: @usuario en LinkedIn" defaultValue={values.sourceReference ?? ""} />
        </label>
      </div>
      <label className="field" style={{ marginTop: 12 }}>
        Mensaje o notas
        <textarea name="context" maxLength={2000} defaultValue={values.context ?? ""} />
      </label>
    </>
  );
}
