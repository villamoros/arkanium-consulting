import { createClerkClient, verifyToken } from '@clerk/backend';

/** Lo que la API necesita saber de Clerk. Se inyecta para poder probarla sin red. */
export interface IdentityGateway {
  /** Verifica el token en el servidor. Devuelve el id del usuario o null si no es válido. */
  verifyBearer(token: string): Promise<string | null>;
  /** Organizaciones en las que el usuario es miembro, con su rol. */
  listOrganizations(userId: string): Promise<Array<{ orgId: string; role: string }>>;
  /** Crea una organización de cliente en Clerk. Devuelve su identificador (org_…). */
  createOrganization(input: { name: string; createdBy: string }): Promise<{ orgId: string }>;
  /** Invita a una persona por correo con un rol de la organización. */
  inviteMember(input: { orgId: string; email: string; role: "org:admin" | "org:member" }): Promise<{ invitationId: string }>;
  /** Retira a una persona de la organización. */
  removeMember(input: { orgId: string; userId: string }): Promise<void>;
  /** Miembros de una organización con su rol (lo ve el administrador de esa organización). */
  listMembers(orgId: string): Promise<Array<{ userId: string; role: string; email: string | null; name: string | null }>>;
  /** Invitaciones pendientes de una organización (aún no aceptadas). */
  listInvitations(orgId: string): Promise<Array<{ id: string; email: string; role: string; createdAt: string }>>;
  /** Cambia el rol de una persona dentro de su organización. */
  updateMemberRole(input: { orgId: string; userId: string; role: "org:admin" | "org:member" }): Promise<void>;
}

export function createClerkGateway(options: { secretKey: string; authorizedParties: string[] }): IdentityGateway {
  const clerk = createClerkClient({ secretKey: options.secretKey });

  return {
    async verifyBearer(token) {
      try {
        const payload = await verifyToken(token, {
          secretKey: options.secretKey,
          authorizedParties: options.authorizedParties,
        });
        return payload.sub ?? null;
      } catch {
        // Token caducado, firma incorrecta u origen no autorizado: se trata igual, sin dar detalles.
        return null;
      }
    },

    async listOrganizations(userId) {
      const response = await clerk.users.getOrganizationMembershipList({ userId, limit: 100 });
      return response.data.map((membership) => ({
        orgId: membership.organization.id,
        role: membership.role,
      }));
    },

    async createOrganization({ name, createdBy }) {
      const organization = await clerk.organizations.createOrganization({ name, createdBy });
      return { orgId: organization.id };
    },

    async inviteMember({ orgId, email, role }) {
      const invitation = await clerk.organizations.createOrganizationInvitation({ organizationId: orgId, emailAddress: email, role });
      return { invitationId: invitation.id };
    },

    async removeMember({ orgId, userId }) {
      await clerk.organizations.deleteOrganizationMembership({ organizationId: orgId, userId });
    },

    async listInvitations(orgId) {
      const response = await clerk.organizations.getOrganizationInvitationList({ organizationId: orgId, status: ['pending'], limit: 100 });
      return response.data.map((invitation) => ({
        id: invitation.id,
        email: invitation.emailAddress,
        role: invitation.role,
        createdAt: new Date(invitation.createdAt).toISOString(),
      }));
    },

    async listMembers(orgId) {
      const response = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 });
      return response.data.map((membership) => ({
        userId: membership.publicUserData?.userId ?? '',
        role: membership.role,
        // El identificador público de Clerk es el correo de la cuenta; el nombre es el de la persona.
        email: membership.publicUserData?.identifier ?? null,
        name: [membership.publicUserData?.firstName, membership.publicUserData?.lastName].filter(Boolean).join(' ') || null,
      }));
    },

    async updateMemberRole({ orgId, userId, role }) {
      await clerk.organizations.updateOrganizationMembership({ organizationId: orgId, userId, role });
    },
  };
}
