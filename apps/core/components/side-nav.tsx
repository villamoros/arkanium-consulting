"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useNav } from "./nav-context";

// Menú de core. Las secciones que aún no tienen pantalla aparecen apagadas, sin enlace.
const GROUPS: Array<{ label: string; items: Array<{ href?: string; label: string }> }> = [
  {
    label: "Ventas",
    items: [{ href: "/", label: "Inicio" }, { href: "/leads", label: "Leads" }, { href: "/reuniones", label: "Reuniones" }, { label: "Clientes" }, { label: "Propuestas" }, { label: "Cobros y facturas" }],
  },
  {
    label: "Operación",
    items: [{ label: "Aprobaciones" }, { label: "Proyectos" }, { label: "Agentes" }, { label: "Presupuesto" }, { label: "Pausas de emergencia" }],
  },
  {
    label: "Mercadeo",
    items: [{ label: "Campañas" }, { label: "Buyer personas" }, { href: "/supresion", label: "Supresión y consentimiento" }, { label: "Insights" }],
  },
];

/**
 * Menú lateral. Bajo 1100 px se desliza desde la izquierda; el botón está en la barra superior
 * (ver SessionBar), junto al logo y el nombre de la plataforma.
 */
export function SideNav() {
  const pathname = usePathname();
  const { open, close } = useNav();
  const firstLink = useRef<HTMLAnchorElement | null>(null);

  // Al abrir, el foco pasa al primer enlace del menú.
  useEffect(() => {
    if (open) firstLink.current?.focus();
  }, [open]);

  return (
    <>
      <nav className="side" id="site-nav" aria-label="Principal" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) close(); }}>
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="side-group">{group.label}</div>
            <ul>
              {group.items.map((item) =>
                item.href ? (
                  <li key={item.label}>
                    <Link href={item.href} aria-current={(item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) ? "page" : undefined} ref={item.href === "/leads" ? firstLink : undefined}>
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
      <div className="nav-scrim" data-scrim onClick={close} />
    </>
  );
}
