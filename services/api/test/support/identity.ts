import type { IdentityGateway } from '../../src/auth/clerk.js';

export const INTERNAL = 'org_INTERNAL';
export const CLIENT = 'org_CLIENT';

/**
 * Doble de Clerk: tokens y membresías fijas. Registra las organizaciones creadas para comprobarlas.
 * Cada token representa a una persona distinta.
 */
export function fakeIdentity() {
  const created: Array<{ name: string; createdBy: string; orgId: string }> = [];
  const tokens: Record<string, string> = {
    'token-owner': 'user_owner',
    'token-member': 'user_team_member',
    'token-client': 'user_client',
    'token-none': 'user_none',
  };
  const memberships: Record<string, Array<{ orgId: string; role: string }>> = {
    user_owner: [{ orgId: INTERNAL, role: 'org:admin' }],
    user_team_member: [{ orgId: INTERNAL, role: 'org:member' }],
    user_client: [{ orgId: CLIENT, role: 'org:admin' }],
    user_none: [],
  };

  const invited: Array<{ orgId: string; email: string; role: string }> = [];
  const removed: Array<{ orgId: string; userId: string }> = [];

  const identity: IdentityGateway & { created: typeof created; invited: typeof invited; removed: typeof removed } = {
    created,
    invited,
    removed,
    inviteMember: async ({ orgId, email, role }) => {
      invited.push({ orgId, email, role });
      return { invitationId: `inv_${invited.length}` };
    },
    removeMember: async ({ orgId, userId }) => {
      removed.push({ orgId, userId });
    },
    verifyBearer: async (token) => tokens[token] ?? null,
    listOrganizations: async (userId) => memberships[userId] ?? [],
    createOrganization: async ({ name, createdBy }) => {
      const orgId = `org_NEW_${created.length + 1}`;
      created.push({ name, createdBy, orgId });
      return { orgId };
    },
  };
  return identity;
}
