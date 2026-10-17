"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Estado compartido del menú: el botón está en la barra superior y el panel lo lee del mismo lugar.
type NavState = { open: boolean; toggle: () => void; close: () => void };

const NavContext = createContext<NavState | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Mientras el menú está abierto, la página no se desplaza y Escape lo cierra.
  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("nav-open");
    };
  }, [open]);

  const value = useMemo<NavState>(
    () => ({ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) }),
    [open],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavState {
  const value = useContext(NavContext);
  if (!value) throw new Error("useNav debe usarse dentro de NavProvider");
  return value;
}
