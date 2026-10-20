// Esqueleto mientras llegan los clientes y sus resúmenes desde la API.
export default function ClientsLoading() {
  return (
    <section className="panel" aria-busy="true" aria-label="Cargando clientes">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p className="muted" style={{ margin: "12px" }}>
        Cargando clientes…
      </p>
    </section>
  );
}
