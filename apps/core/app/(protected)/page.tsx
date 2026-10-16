import { redirect } from "next/navigation";

// La portada de core es la bandeja de leads: la primera rebanada del tablero (ARK-DEV-001).
// instant = false: la redirección depende de la sesión, igual que en el layout protegido.
export const instant = false;

export default function CoreHome() {
  redirect("/leads");
}
