import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { isUuid, messageOf } from "@/lib/action-helpers";

describe("isUuid", () => {
  it("acepta un identificador válido en cualquier mayúscula", () => {
    expect(isUuid("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")).toBe(true);
    expect(isUuid("0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D")).toBe(true);
  });

  it("rechaza texto vacío, formatos incompletos y valores con espacios", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("0a1b2c3d-4e5f")).toBe(false);
    expect(isUuid(" 0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")).toBe(false);
  });
});

describe("messageOf", () => {
  it("muestra el mensaje de la API cuando el error viene de ella", () => {
    expect(messageOf(new ApiError(409, "invalid_state", "La factura ya está anulada."))).toBe("La factura ya está anulada.");
  });

  it("muestra un mensaje genérico para cualquier otro error, sin filtrar detalles técnicos", () => {
    expect(messageOf(new Error("ECONNRESET 10.0.0.5"))).toBe("No pudimos completar la acción. Intenta de nuevo.");
    expect(messageOf(undefined)).toBe("No pudimos completar la acción. Intenta de nuevo.");
  });
});
