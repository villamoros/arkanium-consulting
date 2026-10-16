"use client";

import { UserButton } from "@clerk/nextjs";

const ROLE_LABEL: Record<string, string> = {
  "org:admin": "Administrador",
  "org:member": "Miembro",
};

// Muestra la organización activa y el rol de la persona. «Cerrar sesión» está en el botón de cuenta
// y vuelve al sitio público (afterSignOutUrl en ClerkProvider).
export function SessionBar({ orgName, role, product }: { orgName: string; role?: string | null; product: string }) {
  return (
    <header className="session-bar">
      <div>
        <strong>Arkanium · {product}</strong>
        <p>
          {orgName} · {role ? (ROLE_LABEL[role] ?? role) : "Sin rol"}
        </p>
      </div>
      <UserButton />
    </header>
  );
}
