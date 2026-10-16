import { Suspense } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { SessionBar } from "@/components/session-bar";
import { redirect } from "next/navigation";

// Control de acceso en el servidor: sin sesión, Clerk lleva a la página de acceso del sitio.
// Con sesión pero sin organización, no hay acceso a la app de clientes.
// La comprobación va dentro de <Suspense>: depende de la sesión del visitante, que solo existe en cada petición.
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
  if (!session.orgId) redirect("/sin-acceso");
  const orgName = await organizationName(session.orgId!);
  return (
    <>
      <SessionBar orgName={orgName} role={session.orgRole} product="" />
      {children}
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
