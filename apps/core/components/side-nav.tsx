"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Menú de core. Las secciones que aún no tienen pantalla aparecen apagadas, sin enlace.
const GROUPS: Array<{ label: string; items: Array<{ href?: string; label: string }> }> = [
  {
    label: "Ventas",
    items: [{ href: "/leads", label: "Leads" }, { label: "Reuniones" }, { label: "Clientes" }, { label: "Propuestas" }, { label: "Cobros y facturas" }],
  },
  {
    label: "Operación",
    items: [{ label: "Aprobaciones" }, { label: "Proyectos" }, { label: "Agentes" }, { label: "Presupuesto" }, { label: "Pausas de emergencia" }],
  },
  {
    label: "Mercadeo",
    items: [{ label: "Campañas" }, { label: "Buyer personas" }, { label: "Supresión y consentimiento" }, { label: "Insights" }],
  },
];

/**
 * Menú lateral. Bajo 1100 px se desliza desde la izquierda con el botón del sitio;
 * el botón de cerrar vive dentro del panel y viaja con él (ARK-DESIGN-001).
 */
export function SideNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const firstLink = useRef<HTMLAnchorElement | null>(null);

  // Al abrir, el foco pasa al menú; al cerrar con Escape o con el velo, vuelve al botón.
  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("nav-open");
    };
  }, [open]);

  const label = open ? "Cerrar menú" : "Abrir menú";

  return (
    <>
      <div className="nav-bar">
        <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="site-nav" aria-label={label} onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>
      <nav className="side" id="site-nav" aria-label="Principal" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>
        <div className="brand">ARKANIUM · CORE</div>
        <button type="button" className="nav-toggle nav-toggle--in" aria-expanded={open} aria-controls="site-nav" aria-label={label} onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="side-group">{group.label}</div>
            <ul>
              {group.items.map((item) =>
                item.href ? (
                  <li key={item.label}>
                    <Link href={item.href} aria-current={pathname.startsWith(item.href) ? "page" : undefined} ref={item.href === "/leads" ? firstLink : undefined}>
                      {item.label}
                    </Link>
                  </li>
                ) : (
                  <li key={item.label} className="off" aria-disabled="true">
                    {item.label} <span className="sub">pronto</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </nav>
      <div className="nav-scrim" data-scrim onClick={() => setOpen(false)} />
    </>
  );
}
