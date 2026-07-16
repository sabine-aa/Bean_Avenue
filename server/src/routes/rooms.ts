import { Router } from "express";
import { requireAdmin } from "../auth";
import { prisma } from "../db";
import { actorCtx, audit } from "../lib/activity";
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
  const before = await prisma.room.findUnique({ where: { id } });
  const room = await prisma.room.update({ where: { id }, data });
  const actor = actorCtx(req);
  if (before && "pricePerHour" in data && before.pricePerHour !== room.pricePerHour)
    await audit(actor, {
      section: "Rooms",
      action: "room_price_changed",
      description: `${room.name} price $${before.pricePerHour.toFixed(2)}/hr → $${room.pricePerHour.toFixed(2)}/hr`,
      entity: "Room",
      entityId: id,
      entityName: room.name,
      oldValue: { pricePerHour: before.pricePerHour },
      newValue: { pricePerHour: room.pricePerHour },
    });
  if (before && "isAvailable" in data && before.isAvailable !== room.isAvailable)
    await audit(actor, {
      section: "Rooms",
      action: "room_availability_changed",
      description: `${room.name} ${room.isAvailable ? "made available" : "made unavailable"}`,
      entity: "Room",
      entityId: id,
      entityName: room.name,
    });
  const priceOrAvail =
    ("pricePerHour" in data && before && before.pricePerHour !== room.pricePerHour) ||
    ("isAvailable" in data && before && before.isAvailable !== room.isAvailable);
  if (!priceOrAvail)
    await audit(actor, {
      section: "Rooms",
      action: "room_edited",
      description: `${room.name} details edited (${Object.keys(data).join(", ")})`,
      entity: "Room",
      entityId: id,
      entityName: room.name,
    });
  res.json(outRoom(room));
});
