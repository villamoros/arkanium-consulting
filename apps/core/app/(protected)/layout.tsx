import { Suspense } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SessionBar } from "@/components/session-bar";
import { SideNav } from "@/components/side-nav";

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
    <>
      <SessionBar orgName={orgName} role={session.orgRole} product="Core" />
      <div className="shell">
        <SideNav />
        <main className="content">{children}</main>
      </div>
    </>
  );
}

// Nombre legible de la organización; si falla la consulta, se muestra su identificador.
async function organizationName(orgId: string): Promise<string> {
  try {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    return org.name;
  } catch {
    return orgId;
  }
}
