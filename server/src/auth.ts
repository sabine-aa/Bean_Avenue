import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

/** Express middleware: rejects the request unless a valid admin token is present. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Please sign in." });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET) as { role?: string };
    if (payload.role !== "admin") return res.status(403).json({ error: "Admin access only." });
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired — please sign in again." });
  }
}

// Make the verified customer id available to handlers.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customerId?: number;
    }
  }
}

/** True if the request carries a valid admin token. Use for "admins can also see drafts" reads. */
export function isAdminRequest(req: Request): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  try {
    const payload = jwt.verify(header.slice(7), SECRET) as { role?: string };
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Express middleware: attaches req.customerId if a valid customer token is present, but never blocks. */
export function optionalCustomer(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), SECRET) as { customerId?: number; role?: string };
      if (payload.role === "customer" && payload.customerId) req.customerId = payload.customerId;
    } catch {
      /* ignore invalid/expired token — treat as anonymous */
    }
  }
  next();
}

/** Express middleware: requires a valid customer token and attaches req.customerId. */
export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Please log in to your rewards account." });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET) as { customerId?: number; role?: string };
    if (payload.role !== "customer" || !payload.customerId) {
      return res.status(403).json({ error: "Customer access only." });
    }
    req.customerId = payload.customerId;
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired — please log in again." });
  }
}
