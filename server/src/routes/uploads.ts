import { randomBytes } from "crypto";
import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";

// Uploaded images are stored IN the database (see the Upload model) so they
// persist across Render redeploys / free-tier spin-downs, which wipe local disk.
// They are served publicly at /api/uploads/<name>.
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const uploadsRouter = Router();

// POST /api/uploads  { dataUrl }  (admin) — store an image, return its URL.
uploadsRouter.post("/", requireAdmin, async (req, res) => {
  const dataUrl = String(req.body.dataUrl ?? "");
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return res.status(400).json({ error: "Invalid image data." });

  const mime = match[1].toLowerCase();
  const ext = EXT[mime];
  if (!ext) return res.status(400).json({ error: "Unsupported type — use JPG, PNG, WEBP, GIF or AVIF." });

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Image is too large (max 8 MB)." });

  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  await prisma.upload.create({ data: { name, mime, data: buffer } });
  res.status(201).json({ url: `/api/uploads/${name}` });
});

// GET /api/uploads/:name  (public) — serve a stored image from the database.
uploadsRouter.get("/:name", async (req, res) => {
  const up = await prisma.upload.findUnique({ where: { name: req.params.name } });
  if (!up) return res.status(404).end();
  res.set("Content-Type", up.mime);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(up.data));
});
