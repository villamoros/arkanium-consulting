import type { IdentityGateway } from './clerk.js';

/**
 * Guarda por un minuto las membresías de cada persona. Sin esto, cada petición del owner o de un cliente
 * espera una llamada a Clerk (300 a 900 ms). Se invalida al cambiar o retirar una membresía desde la API.
 * Limitación: un cambio hecho directamente en el panel de Clerk tarda hasta un minuto en verse.
 */
export function withMembershipCache(identity: IdentityGateway, ttlMs = 60_000, now: () => number = Date.now): IdentityGateway {
  const cache = new Map<string, { at: number; value: Array<{ orgId: string; role: string }> }>();

  return {
    ...identity,
    async listOrganizations(userId) {
      const hit = cache.get(userId);
      if (hit && now() - hit.at < ttlMs) return hit.value;
      const value = await identity.listOrganizations(userId);
      cache.set(userId, { at: now(), value });
      return value;
    },
    async removeMember(input) {
      cache.delete(input.userId);
      await identity.removeMember(input);
    },
    async updateMemberRole(input) {
      cache.delete(input.userId);
      await identity.updateMemberRole(input);
    },
  };
}
