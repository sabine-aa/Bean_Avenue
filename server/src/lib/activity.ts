import type { Request } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Who performed an action, and from which part of the system.
export type Actor = { actorId: number | null; actorName: string; actorRole: string; source: string };

const titleRole = (r?: string | null) =>
  r ? r.charAt(0).toUpperCase() + r.slice(1).toLowerCase() : "Staff";

/** Full actor context (name + role + source) for the audit trail. */
export function actorCtx(req: Request): Actor {
  // POS/staff requests carry a verified staff identity from the PIN login.
  if (req.staffId) {
    return { actorId: req.staffId, actorName: req.staffName || "Staff", actorRole: titleRole(req.staffRole), source: "POS" };
  }
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const p = jwt.verify(header.slice(7), SECRET) as { email?: string; name?: string; role?: string; staffRole?: string; staffId?: number };
      if (p.role === "staff" && p.staffId) return { actorId: p.staffId, actorName: p.name || "Staff", actorRole: titleRole(p.staffRole), source: "POS" };
      if (p.role === "admin") return { actorId: null, actorName: p.email || process.env.ADMIN_NAME || "Admin", actorRole: "Manager", source: "Admin" };
    } catch {
      /* ignore invalid token */
    }
  }
  return { actorId: null, actorName: "System", actorRole: "System", source: "System" };
}

/** Best-effort display name of the requester (legacy string form). */
export function actorFrom(req: Request): string {
  return actorCtx(req).actorName;
}

export type AuditOpts = {
  section: string;
  action: string;
  description: string;
  entity?: string;
  entityId?: string | number | null;
  entityName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  orderNumber?: string | null;
};

/** Record an action in the audit trail. Never throws — logging must not break the action. */
export async function audit(actor: Actor, opts: AuditOpts): Promise<void> {
  try {
    await prisma.adminActivityLog.create({
      data: {
        actorId: actor.actorId,
        actor: actor.actorName,
        actorRole: actor.actorRole,
        source: actor.source,
        section: opts.section,
        action: opts.action,
        detail: opts.description,
        entity: opts.entity ?? null,
        entityId: opts.entityId != null ? String(opts.entityId) : null,
        entityName: opts.entityName ?? null,
        oldValue: opts.oldValue != null ? JSON.stringify(opts.oldValue) : null,
        newValue: opts.newValue != null ? JSON.stringify(opts.newValue) : null,
        orderNumber: opts.orderNumber ?? null,
      },
    });
  } catch (err) {
    console.error("audit failed:", err);
  }
}

// Map the legacy `entity` tag onto the new section taxonomy.
const SECTION_BY_ENTITY: Record<string, string> = {
  order: "Orders",
  payment: "Payments",
  zone: "Delivery",
  settings: "System",
  booking: "Rooms",
};

/**
 * Legacy helper kept for existing admin calls (orders/payments/delivery). Routes
 * through the richer trail so those actions still show up with a section.
 */
export async function logActivity(
  actor: string,
  action: string,
  detail: string,
  entity?: string,
  entityId?: string | number
): Promise<void> {
  await audit(
    { actorId: null, actorName: actor, actorRole: "Manager", source: "Admin" },
    {
      section: SECTION_BY_ENTITY[entity ?? ""] ?? "System",
      action,
      description: detail,
      entity,
      entityId,
      orderNumber: entity === "order" && entityId != null ? String(entityId) : null,
    }
  );
}
