import { Router } from "express";
import { optionalCustomer, requireAdmin } from "../auth";
import { prisma } from "../db";
import { rateLimit } from "../lib/rateLimit";

export const eventSuggestionsRouter = Router();

const STATUSES = ["NEW", "REVIEWED", "CONSIDERING", "APPROVED", "REJECTED"];

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// POST /api/event-suggestions  (public — no account required)
eventSuggestionsRouter.post("/", optionalCustomer, async (req, res) => {
  // Honeypot: real users never fill this hidden field. Pretend success so bots
  // don't learn they were caught.
  if (req.body.website) return res.status(201).json({ ok: true });

  // Rate limit per IP (and per account if logged in) — basic spam protection.
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const key = req.customerId ? `evsug:c:${req.customerId}` : `evsug:ip:${ip}`;
  if (!rateLimit(key, 5, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Thanks for the ideas! Please try again in a little while." });
  }

  const idea = str(req.body.idea, 200);
  if (!idea) return res.status(400).json({ error: "Please share your event idea." });

  let name = req.body.name ? str(req.body.name, 100) : null;
  let phone = req.body.phone ? str(req.body.phone, 40) : null;
  if (req.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: req.customerId } });
    if (customer) {
      name = name || customer.name;
      phone = phone || customer.phone;
    }
  }

  await prisma.eventSuggestion.create({
    data: {
      customerId: req.customerId ?? null,
      idea,
      category: str(req.body.category, 60),
      description: str(req.body.description, 1000),
      preferredDay: str(req.body.preferredDay, 60),
      preferredTime: str(req.body.preferredTime, 60),
      name,
      phone,
    },
  });
  res.status(201).json({ ok: true });
});

// ---- Admin ----

// GET /api/event-suggestions  (admin) — newest first, optional status filter
eventSuggestionsRouter.get("/", requireAdmin, async (req, res) => {
  const status = String(req.query.status ?? "");
  const suggestions = await prisma.eventSuggestion.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  res.json(suggestions);
});

// PATCH /api/event-suggestions/:id  (admin) — status and/or admin note
eventSuggestionsRouter.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const data: { status?: string; adminNote?: string | null } = {};
  if ("status" in req.body) {
    const status = String(req.body.status);
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status." });
    data.status = status;
  }
  if ("adminNote" in req.body) {
    const note = String(req.body.adminNote ?? "").trim();
    data.adminNote = note || null;
  }
  const suggestion = await prisma.eventSuggestion.update({ where: { id }, data });
  res.json(suggestion);
});

// DELETE /api/event-suggestions/:id  (admin) — remove spam / duplicates
eventSuggestionsRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.eventSuggestion.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
