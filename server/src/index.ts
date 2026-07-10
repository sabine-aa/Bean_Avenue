import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
// Render (and some hosts) have no IPv6 egress; Node otherwise resolves Gmail's
// IPv6 address first and fails with ENETUNREACH. Prefer IPv4 for all outbound DNS.
setDefaultResultOrder("ipv4first");
import cors from "cors";
import express from "express";
import { signToken } from "./auth";
import { addonsRouter } from "./routes/addons";
import { addressesRouter } from "./routes/addresses";
import { bannersRouter } from "./routes/banners";
import { birthdayRouter } from "./routes/birthday";
import { bookingsRouter } from "./routes/bookings";
import { categoriesRouter } from "./routes/categories";
import { customerAuthRouter } from "./routes/customerAuth";
import { customersRouter } from "./routes/customers";
import { deliveryRouter } from "./routes/delivery";
import { doughnutsRouter } from "./routes/doughnuts";
import { eventsRouter } from "./routes/events";
import { eventSuggestionsRouter } from "./routes/eventSuggestions";
import { featuredRouter } from "./routes/featured";
import { inventoryRouter } from "./routes/inventory";
import { loyaltyRouter } from "./routes/loyalty";
import { menuRouter } from "./routes/menu";
import { notificationsRouter } from "./routes/notifications";
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { posRouter } from "./routes/pos";
import { staffRouter } from "./routes/staff";
import { reportsRouter } from "./routes/reports";
import { rewardsRouter } from "./routes/rewards";
import { roomsRouter } from "./routes/rooms";
import { subscribersRouter } from "./routes/subscribers";
import { suggestionsRouter } from "./routes/suggestions";
import { uploadsRouter, UPLOADS_DIR } from "./routes/uploads";
import { votingRouter } from "./routes/voting";

const app = express();
app.use(cors());
// Raised limit so base64 image uploads (admin photos) fit in the JSON body.
app.use(express.json({ limit: "12mb" }));

// Serve uploaded images (GET); the POST upload route is mounted just after.
app.use("/api/uploads", express.static(UPLOADS_DIR));

// Admin login — checks credentials from .env and returns a token.
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || "admin@beanavenue.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "beanavenue";
  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  const name = process.env.ADMIN_NAME || "Admin";
  res.json({ token: signToken({ email, role: "admin" }), name });
});

// Customer OTP auth (phone/email) + method linking — kept separate from admin auth.
app.use("/api/auth", customerAuthRouter);

app.use("/api/menu", menuRouter);
app.use("/api/doughnuts", doughnutsRouter);
app.use("/api/featured", featuredRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/pos", posRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/staff", staffRouter);
app.use("/api/delivery", deliveryRouter);
app.use("/api/addresses", addressesRouter);
app.use("/api/loyalty", loyaltyRouter);
app.use("/api/birthday", birthdayRouter);
app.use("/api/rewards", rewardsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/suggestions", suggestionsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/event-suggestions", eventSuggestionsRouter);
app.use("/api/voting", votingRouter);
app.use("/api/addons", addonsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/subscribers", subscribersRouter);
app.use("/api/banners", bannersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/uploads", uploadsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Temporary SMTP diagnostic (gated by the JWT secret). Remove after debugging.
app.get("/api/_debug/email", async (req, res) => {
  if (req.query.key !== process.env.JWT_SECRET) return res.status(403).json({ error: "forbidden" });
  const { debugSmtp } = await import("./lib/otp");
  const port = Number(req.query.port) || 465;
  const to = String(req.query.to || process.env.SMTP_USER || "");
  res.json({ port, to, ...(await debugSmtp(port, to)) });
});

// Fallback error handler so thrown errors return JSON, not HTML.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Bean Avenue API running on http://localhost:${port}`);
});

// Keep the server alive even if an unexpected error slips through a handler.
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err));
