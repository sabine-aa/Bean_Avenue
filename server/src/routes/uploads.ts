import { randomBytes } from "crypto";
import { Router } from "express";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { requireAdmin } from "../auth";

// Uploaded images live on disk under server/uploads and are served at
// /api/uploads/<file> (so the existing /api Vite proxy reaches them in dev).
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
mkdirSync(UPLOADS_DIR, { recursive: true });

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const uploadsRouter = Router();

// POST /api/uploads  { dataUrl }  (admin) — store an image, return its URL.
uploadsRouter.post("/", requireAdmin, (req, res) => {
  const dataUrl = String(req.body.dataUrl ?? "");
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return res.status(400).json({ error: "Invalid image data." });

  const ext = EXT[match[1].toLowerCase()];
  if (!ext) return res.status(400).json({ error: "Unsupported type — use JPG, PNG, WEBP, GIF or AVIF." });

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Image is too large (max 8 MB)." });

  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  writeFileSync(path.join(UPLOADS_DIR, name), buffer);
  res.status(201).json({ url: `/api/uploads/${name}` });
});
