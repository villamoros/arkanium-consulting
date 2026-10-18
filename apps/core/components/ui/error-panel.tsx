"use client";

import Link from "next/link";

/**
 * Pantalla de error de una ruta. Next la muestra cuando una página falla sin controlar el error.
 * Ofrece reintentar y volver al inicio, en lugar de la página genérica del framework.
 */
export function ErrorPanel({ reset, digest }: { reset: () => void; digest?: string }) {
  return (
    <section className="panel state" role="alert">
      <h2>Algo no salió bien en esta pantalla</h2>
      <p>Vuelve a intentarlo. Si sigue igual, anota el código y revisa la terminal de Core.</p>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button type="button" className="primary" onClick={reset}>
          Reintentar
        </button>
        <Link href="/" className="secondary" style={{ padding: "8px 14px", borderRadius: 6 }}>
          Ir al inicio
        </Link>
      </div>
      {digest ? <p className="sub">Código: {digest}</p> : null}
    </section>
  );
}
