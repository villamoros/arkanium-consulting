import type { ReactNode } from "react";

// Estados de la plantilla de diseño: vacío y error. El contenido lo decide cada pantalla.
export function StatePanel({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="panel state" aria-live="polite">
      <h2>{title}</h2>
      {children ? <div>{children}</div> : null}
    </section>
  );
}
