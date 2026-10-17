// Esqueleto mientras llega la agenda desde la API.
export default function MeetingsLoading() {
  return (
    <section className="panel" aria-busy="true" aria-label="Cargando reuniones">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p className="muted" style={{ margin: "12px" }}>
        Cargando reuniones…
      </p>
    </section>
  );
}
