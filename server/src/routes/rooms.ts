import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { outRoom, toJson } from "../lib/serialize";

export const roomsRouter = Router();

// GET /api/rooms  (public)
roomsRouter.get("/", async (_req, res) => {
  const rooms = await prisma.room.findMany({ orderBy: { id: "asc" } });
  res.json(rooms.map(outRoom));
});

// PATCH /api/rooms/:id  (admin) — edit room details or toggle availability
roomsRouter.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body;
  const data: Record<string, unknown> = {};
  for (const key of ["name", "description", "isAvailable"]) {
    if (key in b) data[key] = b[key];
  }
  for (const jsonKey of ["amenities", "rules", "images"]) {
    if (jsonKey in b) data[jsonKey] = toJson(b[jsonKey]);
  }
  for (const numKey of ["pricePerHour", "capacityMin", "capacityMax", "openHour", "closeHour", "bufferMinutes"]) {
    if (numKey in b) data[numKey] = Number(b[numKey]);
  }
  const room = await prisma.room.update({ where: { id }, data });
  res.json(outRoom(room));
});
