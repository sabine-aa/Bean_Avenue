import { Router } from "express";
import { optionalCustomer, requireAdmin, requireCustomer } from "../auth";
import { prisma } from "../db";

export const votingRouter = Router();

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function cleanBody(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = str(body.title, 200);
  if ("description" in body) data.description = str(body.description, 1000);
  if ("category" in body) data.category = str(body.category, 60);
  if ("possibleDate" in body) data.possibleDate = str(body.possibleDate, 100);
  if ("image" in body) data.image = str(body.image, 500) || null;
  if ("isPublished" in body) data.isPublished = Boolean(body.isPublished);
  if ("status" in body) {
    const s = String(body.status);
    if (["OPEN", "CLOSED", "SELECTED"].includes(s)) data.status = s;
  }
  if ("closesAt" in body) {
    const v = body.closesAt;
    data.closesAt = v ? new Date(String(v)) : null;
  }
  if ("sortOrder" in body) data.sortOrder = Math.round(Number(body.sortOrder) || 0);
  return data;
}

const isClosed = (o: { status: string; closesAt: Date | null }) =>
  o.status !== "OPEN" || (o.closesAt != null && o.closesAt.getTime() < Date.now());

// ---- Public / customer ----

// GET /api/voting  — published options with vote counts and (if logged in) whether
// the current customer has voted on each.
votingRouter.get("/", optionalCustomer, async (req, res) => {
  const options = await prisma.votingOption.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { votes: true } } },
  });
  let mine = new Set<number>();
  if (req.customerId && options.length) {
    const votes = await prisma.vote.findMany({
      where: { customerId: req.customerId, votingOptionId: { in: options.map((o) => o.id) } },
      select: { votingOptionId: true },
    });
    mine = new Set(votes.map((v) => v.votingOptionId));
  }
  res.json(
    options.map(({ _count, ...o }) => ({
      ...o,
      voteCount: _count.votes,
      hasVoted: mine.has(o.id),
    }))
  );
});

// POST /api/voting/:id/vote  — cast a vote (verified customers only). Idempotent:
// the DB unique constraint means a second vote from the same account is a no-op.
votingRouter.post("/:id/vote", requireCustomer, async (req, res) => {
  const id = Number(req.params.id);
  const option = await prisma.votingOption.findUnique({ where: { id } });
  if (!option || !option.isPublished) return res.status(404).json({ error: "Idea not found." });
  if (isClosed(option)) return res.status(400).json({ error: "Voting has closed for this idea." });
  try {
    await prisma.vote.create({ data: { votingOptionId: id, customerId: req.customerId! } });
  } catch (e) {
    // P2002 = already voted; treat as success so repeated clicks are harmless.
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
  const voteCount = await prisma.vote.count({ where: { votingOptionId: id } });
  res.json({ ok: true, hasVoted: true, voteCount });
});

// DELETE /api/voting/:id/vote  — remove your vote while voting is still open.
votingRouter.delete("/:id/vote", requireCustomer, async (req, res) => {
  const id = Number(req.params.id);
  const option = await prisma.votingOption.findUnique({ where: { id } });
  if (!option) return res.status(404).json({ error: "Idea not found." });
  if (isClosed(option)) return res.status(400).json({ error: "Voting has closed for this idea." });
  await prisma.vote.deleteMany({ where: { votingOptionId: id, customerId: req.customerId! } });
  const voteCount = await prisma.vote.count({ where: { votingOptionId: id } });
  res.json({ ok: true, hasVoted: false, voteCount });
});

// ---- Admin ----

// GET /api/voting/all  — every option (incl. unpublished) with vote totals.
votingRouter.get("/all", requireAdmin, async (_req, res) => {
  const options = await prisma.votingOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { votes: true } } },
  });
  res.json(options.map(({ _count, ...o }) => ({ ...o, voteCount: _count.votes })));
});

// PATCH /api/voting/reorder  — declared before "/:id"
votingRouter.patch("/reorder", requireAdmin, async (req, res) => {
  const ids: number[] = req.body.ids ?? [];
  await prisma.$transaction(
    ids.map((id, index) => prisma.votingOption.update({ where: { id }, data: { sortOrder: index } }))
  );
  res.json({ ok: true });
});

// POST /api/voting  — create a voting option manually.
votingRouter.post("/", requireAdmin, async (req, res) => {
  const data = cleanBody(req.body);
  if (!data.title) return res.status(400).json({ error: "A title is required." });
  const max = await prisma.votingOption.aggregate({ _max: { sortOrder: true } });
  data.sortOrder = (max._max.sortOrder ?? 0) + 1;
  const option = await prisma.votingOption.create({ data: data as never });
  res.status(201).json({ ...option, voteCount: 0 });
});

// POST /api/voting/from-suggestion/:id  — convert an EventSuggestion into a voting option.
votingRouter.post("/from-suggestion/:id", requireAdmin, async (req, res) => {
  const sid = Number(req.params.id);
  const s = await prisma.eventSuggestion.findUnique({ where: { id: sid } });
  if (!s) return res.status(404).json({ error: "Suggestion not found." });
  const max = await prisma.votingOption.aggregate({ _max: { sortOrder: true } });
  const option = await prisma.votingOption.create({
    data: {
      title: s.idea.slice(0, 200),
      description: s.description,
      category: s.category,
      sourceSuggestionId: s.id,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  // Mark the suggestion approved so the manager can see it progressed.
  await prisma.eventSuggestion.update({ where: { id: sid }, data: { status: "APPROVED" } });
  res.status(201).json({ ...option, voteCount: 0 });
});

// PATCH /api/voting/:id  — edit fields / publish / hide / close.
votingRouter.patch("/:id", requireAdmin, async (req, res) => {
  const option = await prisma.votingOption.update({
    where: { id: Number(req.params.id) },
    data: cleanBody(req.body),
  });
  res.json(option);
});

// POST /api/voting/:id/select  — pick the winner and spin up an Event draft.
votingRouter.post("/:id/select", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const option = await prisma.votingOption.findUnique({ where: { id } });
  if (!option) return res.status(404).json({ error: "Idea not found." });

  const max = await prisma.event.aggregate({ _max: { sortOrder: true } });
  const event = await prisma.event.create({
    data: {
      title: option.title,
      category: option.category,
      description: option.description,
      image: option.image,
      startTime: option.closesAt ?? new Date(), // placeholder — manager sets the real date
      isPublished: false, // lands as a draft to finish in the Events manager
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  await prisma.votingOption.update({
    where: { id },
    data: { status: "SELECTED", convertedEventId: event.id },
  });
  res.json({ ok: true, eventId: event.id });
});

// DELETE /api/voting/:id
votingRouter.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.votingOption.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});
