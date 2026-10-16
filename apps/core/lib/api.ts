import { auth } from "@clerk/nextjs/server";

/** Error de la API con su código y mensaje, listo para mostrar al owner. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Llama a la API de Arkanium con la sesión de Clerk de quien está usando core.
 * Solo se ejecuta en el servidor: el token nunca llega al navegador.
 */
export async function apiFetch<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const base = process.env.API_URL;
  if (!base) throw new ApiError(503, "api_not_configured", "Falta API_URL en apps/core/.env.local.");

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) throw new ApiError(401, "unauthorized", "Tu sesión no es válida. Vuelve a entrar.");

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(503, "unreachable", "No llegamos a la API. Revisa que esté encendida e intenta de nuevo.");
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(response.status, data.error ?? "error", data.message ?? "La API respondió con un error.");
  }
  return (await response.json()) as T;
}
