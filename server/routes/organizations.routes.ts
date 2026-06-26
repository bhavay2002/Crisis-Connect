import type { Express } from "express";
import { isAuthenticated } from "../middleware/jwtAuth";
import { authorize } from "../middleware/authorize";
import { db } from "../db/db";
import { organizations, organizationMembers, users } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "../utils/logger";
import { eventBus } from "../modules/events/event-bus";

export function registerOrganizationRoutes(app: Express) {
  // List all organizations (org members + admins)
  app.get("/api/organizations", isAuthenticated, authorize("org:view"), async (req: any, res) => {
    try {
      const orgs = await db
        .select()
        .from(organizations)
        .where(eq(organizations.isActive, true))
        .orderBy(desc(organizations.createdAt));
      res.json({ organizations: orgs, total: orgs.length });
    } catch (err) {
      logger.error("Failed to list organizations", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create organization
  app.post("/api/organizations", isAuthenticated, authorize("org:create"), async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const { name, type, description, contactEmail, contactPhone, website, region } = req.body;
      if (!name || !type) {
        return res.status(400).json({ message: "name and type are required" });
      }
      const [org] = await db
        .insert(organizations)
        .values({ name, type, description, contactEmail, contactPhone, website, region, createdBy: userId })
        .returning();

      // Auto-add creator as owner
      await db.insert(organizationMembers).values({ orgId: org.id, userId, role: "owner" });

      eventBus.publish({ type: "ORG_CREATED", payload: { orgId: org.id, name, type, createdBy: userId } });
      logger.info(`Organization created`, { orgId: org.id, name, userId });
      res.status(201).json(org);
    } catch (err) {
      logger.error("Failed to create organization", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single organization
  app.get("/api/organizations/:id", isAuthenticated, authorize("org:view"), async (req: any, res) => {
    try {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, req.params.id));
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const members = await db
        .select({
          id: organizationMembers.id,
          userId: organizationMembers.userId,
          role: organizationMembers.role,
          joinedAt: organizationMembers.joinedAt,
          name: users.name,
          email: users.email,
          userRole: users.role,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(eq(organizationMembers.orgId, req.params.id));

      res.json({ ...org, members });
    } catch (err) {
      logger.error("Failed to get organization", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update organization
  app.patch("/api/organizations/:id", isAuthenticated, authorize("org:manage"), async (req: any, res) => {
    try {
      const { name, description, contactEmail, contactPhone, website, region, isVerified, isActive } = req.body;
      const [org] = await db
        .update(organizations)
        .set({ name, description, contactEmail, contactPhone, website, region, isVerified, isActive, updatedAt: new Date() })
        .where(eq(organizations.id, req.params.id))
        .returning();
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (err) {
      logger.error("Failed to update organization", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add member to organization
  app.post("/api/organizations/:id/members", isAuthenticated, authorize("org:manage"), async (req: any, res) => {
    try {
      const { userId, role = "member" } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const [existing] = await db
        .select()
        .from(organizationMembers)
        .where(and(eq(organizationMembers.orgId, req.params.id), eq(organizationMembers.userId, userId)));
      if (existing) return res.status(409).json({ message: "User is already a member" });

      const [member] = await db
        .insert(organizationMembers)
        .values({ orgId: req.params.id, userId, role })
        .returning();
      res.status(201).json(member);
    } catch (err) {
      logger.error("Failed to add member", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove member from organization
  app.delete("/api/organizations/:id/members/:userId", isAuthenticated, authorize("org:manage"), async (req: any, res) => {
    try {
      await db
        .delete(organizationMembers)
        .where(and(eq(organizationMembers.orgId, req.params.id), eq(organizationMembers.userId, req.params.userId)));
      res.json({ message: "Member removed" });
    } catch (err) {
      logger.error("Failed to remove member", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get my organizations
  app.get("/api/organizations/me/memberships", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const memberships = await db
        .select({
          orgId: organizationMembers.orgId,
          memberRole: organizationMembers.role,
          joinedAt: organizationMembers.joinedAt,
          orgName: organizations.name,
          orgType: organizations.type,
          isVerified: organizations.isVerified,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.orgId, organizations.id))
        .where(and(eq(organizationMembers.userId, userId), eq(organizations.isActive, true)));
      res.json({ memberships });
    } catch (err) {
      logger.error("Failed to get memberships", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Org-level analytics (tenant-scoped)
  app.get("/api/organizations/:id/analytics", isAuthenticated, authorize("analytics:view"), async (req: any, res) => {
    try {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, req.params.id));
      if (!org) return res.status(404).json({ message: "Organization not found" });

      const memberCount = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, req.params.id))
        .then(r => r.length);

      const memberList = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, req.params.id));

      const roleCounts = memberList.reduce<Record<string, number>>((acc, m) => {
        acc[m.role] = (acc[m.role] || 0) + 1;
        return acc;
      }, {});

      res.json({
        organization: { id: org.id, name: org.name, type: org.type },
        analytics: {
          memberCount,
          roleCounts,
          isVerified: org.isVerified,
          createdAt: org.createdAt,
        },
      });
    } catch (err) {
      logger.error("Failed to get org analytics", err instanceof Error ? err : undefined);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
