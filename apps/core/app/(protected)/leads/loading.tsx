// Esqueleto mientras llega la lista de leads desde la API.
export default function LeadsLoading() {
  return (
    <section className="panel" aria-busy="true" aria-label="Cargando leads">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p className="muted" style={{ margin: "12px" }}>
        Cargando leads…
      </p>
    </section>
  );
}
