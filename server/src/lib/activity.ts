import type { Request } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/** Best-effort identity of the admin making a request (from their JWT). */
export function actorFrom(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), SECRET) as { email?: string };
      if (payload.email) return payload.email;
    } catch {
      /* ignore */
    }
  }
  return process.env.ADMIN_NAME || "Admin";
}

/** Record a sensitive admin action in the audit trail. Never throws. */
export async function logActivity(
  actor: string,
  action: string,
  detail: string,
  entity?: string,
  entityId?: string | number
): Promise<void> {
  try {
    await prisma.adminActivityLog.create({
      data: { actor, action, detail, entity: entity ?? null, entityId: entityId != null ? String(entityId) : null },
    });
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}
