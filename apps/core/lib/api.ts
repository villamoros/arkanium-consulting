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

/** Mensaje claro para el owner según la respuesta de la API. */
function describeFailure(status: number, code: string, detail?: string): string {
  if (detail) return detail;
  if (status === 401) return "La API no reconoce tu sesión. Cierra sesión y vuelve a entrar.";
  if (status === 403) return "Tu cuenta no tiene permiso para esta pantalla. Debe ser administradora de la organización interna.";
  if (status === 404) return "La API no tiene esta ruta. Puede ser una versión anterior: reinicia la API.";
  if (status >= 500) return "La API tuvo un error interno. Revisa su terminal para ver el detalle.";
  return `La API respondió con un error (${status}: ${code}).`;
}

/**
 * Llama a la API de Arkanium con la sesión de Clerk de quien está usando core.
 * Solo se ejecuta en el servidor: el token nunca llega al navegador.
 */
export async function apiFetch<T>(path: string, options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<T> {
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
    const code = data.error ?? "error";
    const message = describeFailure(response.status, code, data.message);
    // Detalle para diagnosticar en la terminal de core; el visitante ve el mensaje en español.
    console.error("[core → api]", options.method ?? "GET", path, response.status, code);
    throw new ApiError(response.status, code, message);
  }
  // 204 Sin contenido (por ejemplo, al eliminar): no hay cuerpo que leer.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
