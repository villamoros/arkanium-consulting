/**
 * Esqueleto de carga de una pantalla. Lo usan todos los `loading.tsx` de Core para que la carga
 * se vea igual en cada módulo.
 */
export function PageLoading({ label }: { label: string }) {
  return (
    <section className="panel" aria-busy="true" aria-label={label}>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p className="muted" style={{ margin: "12px" }}>
        {label}…
      </p>
    </section>
  );
}
