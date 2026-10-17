import { redirect } from "next/navigation";

// El detalle vive junto a la lista, como en el diseño de core: esta ruta solo lleva a esa selección.
// instant = false: la redirección depende de la sesión, igual que en el resto de rutas protegidas.
export const instant = false;

export default async function ProjectDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/proyectos?id=${encodeURIComponent(id)}`);
}
