import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
  // La raíz de Turbopack es el monorepo: evita que Next tome un package.json de una carpeta superior (p. ej. el perfil de usuario).
  turbopack: { root: path.resolve(process.cwd(), "../..") },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
