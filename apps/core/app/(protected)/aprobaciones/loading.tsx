// Esqueleto mientras llega la cola desde la API.
export default function ApprovalsLoading() {
  return (
    <section className="panel" aria-busy="true" aria-label="Cargando aprobaciones">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p className="muted" style={{ margin: "12px" }}>Cargando aprobaciones…</p>
    </section>
  );
}
