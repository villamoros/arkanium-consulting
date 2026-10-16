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
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 24px",
        borderBottom: "1px solid rgba(230,232,235,0.14)",
      }}
    >
      <div>
        <strong>Arkanium · {product}</strong>
        <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>
          {orgName} · {role ? (ROLE_LABEL[role] ?? role) : "Sin rol"}
        </p>
      </div>
      <UserButton />
    </header>
  );
}
