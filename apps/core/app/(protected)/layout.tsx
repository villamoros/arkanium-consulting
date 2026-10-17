import { Suspense } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SessionBar } from "@/components/session-bar";
import { SideNav } from "@/components/side-nav";
import { NavProvider } from "@/components/nav-context";

// Control de acceso en el servidor: solo el equipo de la organización interna entra a core.
// La comprobación va dentro de <Suspense>: depende de la sesión del visitante, que solo existe en cada petición.
// instant = false: la sesión solo existe por petición; la validación de navegación instantánea no puede
// comprobarla y la guía de Next lo recomienda para rutas que leen la sesión (authentication-with-cache-components).
export const instant = false;

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AccessGate>{children}</AccessGate>
    </Suspense>
  );
}

async function AccessGate({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  if (session.orgId !== process.env.ARKANIUM_ORG_ID) redirect("/sin-acceso");
  const orgName = await organizationName(session.orgId!);
  return (
    <NavProvider>
      <SessionBar orgName={orgName} role={session.orgRole} product="Core" />
      <div className="shell">
        <SideNav />
        <main className="content">{children}</main>
      </div>
    </NavProvider>
  );
}

// Nombre legible de la organización. Se guarda 10 minutos: pedirlo a Clerk en cada navegación tardaba segundos.
// Si falla la consulta, se muestra su identificador.
const NAME_TTL_MS = 10 * 60 * 1000;
const names = new Map<string, { name: string; at: number }>();

async function organizationName(orgId: string): Promise<string> {
  // Marca la petición como dinámica: la hora (Date.now) solo existe al atender una petición real, no al prerenderizar.
  await connection();
  const hit = names.get(orgId);
  if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.name;
  try {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    names.set(orgId, { name: org.name, at: Date.now() });
    return org.name;
  } catch {
    return orgId;
  }
}
