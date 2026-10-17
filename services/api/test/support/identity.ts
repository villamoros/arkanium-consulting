import type { IdentityGateway } from '../../src/auth/clerk.js';

export const INTERNAL = 'org_INTERNAL';
export const CLIENT = 'org_CLIENT';
export const OTHER_CLIENT = 'org_OTHER';

/**
 * Doble de Clerk: tokens, membresías y equipos fijos. Cada token representa a una persona distinta.
 *  - token-owner: owner de Arkanium (org interna, admin).
 *  - token-member: miembro del equipo de Arkanium (no es owner).
 *  - token-client: administrador de la organización cliente CLIENT.
 *  - token-client-member: miembro (no admin) de CLIENT.
 *  - token-other: administrador de OTHER_CLIENT (otro cliente, para probar aislamiento).
 *  - token-none: sin membresías.
 */
export function fakeIdentity() {
  const created: Array<{ name: string; createdBy: string; orgId: string }> = [];
  const pendingInvites: Record<string, Array<{ id: string; email: string; role: string; createdAt: string }>> = {};
  const tokens: Record<string, string> = {
    'token-owner': 'user_owner',
    'token-member': 'user_team_member',
    'token-client': 'user_client',
    'token-client-member': 'user_client_member',
    'token-other': 'user_other',
    'token-none': 'user_none',
  };
  const memberships: Record<string, Array<{ orgId: string; role: string }>> = {
    user_owner: [{ orgId: INTERNAL, role: 'org:admin' }],
    user_team_member: [{ orgId: INTERNAL, role: 'org:member' }],
    user_client: [{ orgId: CLIENT, role: 'org:admin' }],
    user_client_member: [{ orgId: CLIENT, role: 'org:member' }],
    user_client_2: [{ orgId: CLIENT, role: 'org:member' }],
    user_other: [{ orgId: OTHER_CLIENT, role: 'org:admin' }],
    user_none: [],
  };
  /** Miembros de cada organización de cliente, con su rol. */
  const teams: Record<string, Array<{ userId: string; role: string; email: string | null }>> = {
    [CLIENT]: [
      { userId: 'user_client', role: 'org:admin', email: 'admin@empresa.test' },
      { userId: 'user_client_member', role: 'org:member', email: 'miembro@empresa.test' },
      { userId: 'user_client_2', role: 'org:member', email: 'otro@empresa.test' },
    ],
    [OTHER_CLIENT]: [{ userId: 'user_other', role: 'org:admin', email: 'otro-cliente@ejemplo.test' }],
  };

  const invited: Array<{ orgId: string; email: string; role: string }> = [];
  const removed: Array<{ orgId: string; userId: string }> = [];
  const roleChanges: Array<{ orgId: string; userId: string; role: string }> = [];

  const identity: IdentityGateway & {
    created: typeof created;
    invited: typeof invited;
    removed: typeof removed;
    roleChanges: typeof roleChanges;
  } = {
    created,
    invited,
    removed,
    roleChanges,
    inviteMember: async ({ orgId, email, role }) => {
      invited.push({ orgId, email, role });
      return { invitationId: `inv_${invited.length}` };
    },
    removeMember: async ({ orgId, userId }) => {
      removed.push({ orgId, userId });
      teams[orgId] = (teams[orgId] ?? []).filter((m) => m.userId !== userId);
    },
    verifyBearer: async (token) => tokens[token] ?? null,
    listOrganizations: async (userId) => memberships[userId] ?? [],
    createOrganization: async ({ name, createdBy }) => {
      const orgId = `org_NEW_${created.length + 1}`;
      created.push({ name, createdBy, orgId });
      return { orgId };
    },
    listMembers: async (orgId) => teams[orgId] ?? [],
    listInvitations: async (orgId) => pendingInvites[orgId] ?? [],
    updateMemberRole: async ({ orgId, userId, role }) => {
      roleChanges.push({ orgId, userId, role });
      teams[orgId] = (teams[orgId] ?? []).map((m) => (m.userId === userId ? { ...m, role } : m));
    },
  };
  return identity;
}
