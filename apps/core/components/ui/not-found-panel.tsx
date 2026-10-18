import Link from "next/link";

/** Pantalla para una ruta que no existe dentro de Core. */
export function NotFoundPanel() {
  return (
    <section className="panel state">
      <h2>No encontramos esta página</h2>
      <p>Puede que el enlace haya cambiado o que el elemento ya no exista.</p>
      <div className="actions" style={{ justifyContent: "center" }}>
        <Link href="/" className="primary" style={{ padding: "8px 14px", borderRadius: 6 }}>
          Ir al inicio
        </Link>
      </div>
    </section>
  );
}
