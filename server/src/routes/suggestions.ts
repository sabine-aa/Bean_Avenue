import { Router } from "express";
import { optionalCustomer, requireAdmin } from "../auth";
import { prisma } from "../db";

export const suggestionsRouter = Router();

// POST /api/suggestions  (public) — anyone can send feedback, logged in or not.
suggestionsRouter.post("/", optionalCustomer, async (req, res) => {
  const message = String(req.body.message ?? "").trim();
  if (!message) return res.status(400).json({ error: "Please write a message before sending." });

  let name = req.body.name ? String(req.body.name).trim() : null;
  let phone = req.body.phone ? String(req.body.phone).trim() : null;

  // If they're logged in, link the account and fill any blanks from it.
  if (req.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: req.customerId } });
    if (customer) {
      name = name || customer.name;
      phone = phone || customer.phone;
    }
  }

  await prisma.suggestion.create({
    data: { customerId: req.customerId ?? null, name, phone, message: message.slice(0, 2000) },
  });
  res.status(201).json({ ok: true });
});

// ---- Admin ----

// GET /api/suggestions  (admin) — newest first, optional status filter
suggestionsRouter.get("/", requireAdmin, async (req, res) => {
  const status = String(req.query.status ?? "");
  const suggestions = await prisma.suggestion.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });
  res.json(suggestions);
});

// PATCH /api/suggestions/:id  (admin) — update status and/or admin note
suggestionsRouter.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const data: { status?: string; adminNote?: string | null } = {};
  if ("status" in req.body) {
    const status = String(req.body.status);
    if (!["NEW", "REVIEWED", "RESOLVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    data.status = status;
  }
  if ("adminNote" in req.body) {
    const note = String(req.body.adminNote ?? "").trim();
    data.adminNote = note || null;
  }
  const suggestion = await prisma.suggestion.update({ where: { id }, data });
  res.json(suggestion);
});
