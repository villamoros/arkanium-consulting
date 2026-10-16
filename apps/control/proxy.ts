import { clerkMiddleware } from "@clerk/nextjs/server";

// Solo sostiene la sesión de Clerk. El control de acceso vive en app/(protected)/layout.tsx,
// junto a las páginas que protege (recomendación del SDK: no depender del emparejamiento de rutas).
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
