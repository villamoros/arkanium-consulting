// Esqueleto mientras llegan las propuestas desde la API.
export default function ProposalsLoading() {
  return (
    <section className="panel" aria-busy="true" aria-label="Cargando propuestas">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p className="muted" style={{ margin: "12px" }}>Cargando propuestas…</p>
    </section>
  );
}
