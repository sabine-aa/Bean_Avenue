import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

/** Express middleware: rejects the request unless a valid admin token is present. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Please sign in." });
  }
  try {
    jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired — please sign in again." });
  }
}
