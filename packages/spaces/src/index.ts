import { randomBytes } from "node:crypto";

export type Space = {
  id: string;
  type: "personal" | "shared";
  name: string;
  ownerUserId: string;
  status: "active" | "suspended" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type SpaceMembership = {
  spaceId: string;
  userId: string;
  role: "owner" | "admin" | "operator" | "member" | "viewer";
  status: "active" | "invited" | "suspended" | "revoked";
  createdAt: string;
};

export type SpaceService = {
  ensurePersonalSpace: (userId: string) => Promise<Space>;
  getSpace: (spaceId: string) => Promise<Space | undefined>;
  listSpacesForUser: (userId: string) => Promise<Space[]>;
  requireActiveMembership: (userId: string, spaceId: string) => Promise<SpaceMembership>;
  assertSpaceOwnership: (userId: string, spaceId: string) => Promise<void>;
  revokeMembership: (userId: string, spaceId: string) => Promise<void>;
};

export const createSpaceService = (): SpaceService => {
  const spaces = new Map<string, Space>();
  const memberships = new Map<string, SpaceMembership>(); // key: `${spaceId}:${userId}`

  const membershipKey = (spaceId: string, userId: string) => `${spaceId}:${userId}`;

  return {
    async ensurePersonalSpace(userId: string): Promise<Space> {
      // Find existing personal space owned by userId
      const existing = [...spaces.values()].find(
        (s) => s.type === "personal" && s.ownerUserId === userId && s.status === "active"
      );

      if (existing) {
        return structuredClone(existing);
      }

      const now = new Date().toISOString();
      const id = `spc_${randomBytes(8).toString("hex")}`;
      const newSpace: Space = {
        id,
        type: "personal",
        name: "Personal Space",
        ownerUserId: userId,
        status: "active",
        createdAt: now,
        updatedAt: now
      };

      const ownerMembership: SpaceMembership = {
        spaceId: id,
        userId,
        role: "owner",
        status: "active",
        createdAt: now
      };

      spaces.set(id, structuredClone(newSpace));
      memberships.set(membershipKey(id, userId), structuredClone(ownerMembership));

      return structuredClone(newSpace);
    },

    async getSpace(spaceId: string): Promise<Space | undefined> {
      const space = spaces.get(spaceId);
      return space ? structuredClone(space) : undefined;
    },

    async listSpacesForUser(userId: string): Promise<Space[]> {
      const activeSpaceIds = [...memberships.values()]
        .filter((m) => m.userId === userId && m.status === "active")
        .map((m) => m.spaceId);

      return [...spaces.values()]
        .filter((s) => activeSpaceIds.includes(s.id))
        .map((s) => structuredClone(s));
    },

    async requireActiveMembership(userId: string, spaceId: string): Promise<SpaceMembership> {
      const membership = memberships.get(membershipKey(spaceId, userId));
      if (!membership || membership.status !== "active") {
        throw new Error(`Active membership in space ${spaceId} required for user ${userId}`);
      }
      return structuredClone(membership);
    },

    async assertSpaceOwnership(userId: string, spaceId: string): Promise<void> {
      const space = spaces.get(spaceId);
      if (!space || space.ownerUserId !== userId) {
        throw new Error(`Ownership of space ${spaceId} required for user ${userId}`);
      }
    },

    async revokeMembership(userId: string, spaceId: string): Promise<void> {
      const key = membershipKey(spaceId, userId);
      const membership = memberships.get(key);
      if (membership) {
        membership.status = "revoked";
        memberships.set(key, structuredClone(membership));
      }
    }
  };
};
