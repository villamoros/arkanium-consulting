import { SignOutButton } from "@clerk/nextjs";

export default function SinAcceso() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ maxWidth: 560 }}>
        <h1>No tienes acceso</h1>
        <p>
          Tu cuenta no tiene permiso para esta aplicación. Si crees que es un error, pide una invitación a tu
          organización.
        </p>
        <SignOutButton redirectUrl={process.env.NEXT_PUBLIC_WEB_URL ?? "/"} />
      </section>
    </main>
  );
}
