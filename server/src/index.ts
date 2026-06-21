import "dotenv/config";
import cors from "cors";
import express from "express";
import { signToken } from "./auth";
import { addonsRouter } from "./routes/addons";
import { bannersRouter } from "./routes/banners";
import { birthdayRouter } from "./routes/birthday";
import { bookingsRouter } from "./routes/bookings";
import { categoriesRouter } from "./routes/categories";
import { customerAuthRouter } from "./routes/customerAuth";
import { customersRouter } from "./routes/customers";
import { doughnutsRouter } from "./routes/doughnuts";
import { eventsRouter } from "./routes/events";
import { eventSuggestionsRouter } from "./routes/eventSuggestions";
import { featuredRouter } from "./routes/featured";
import { loyaltyRouter } from "./routes/loyalty";
import { menuRouter } from "./routes/menu";
import { notificationsRouter } from "./routes/notifications";
import { ordersRouter } from "./routes/orders";
import { reportsRouter } from "./routes/reports";
import { rewardsRouter } from "./routes/rewards";
import { roomsRouter } from "./routes/rooms";
import { subscribersRouter } from "./routes/subscribers";
import { suggestionsRouter } from "./routes/suggestions";
import { votingRouter } from "./routes/voting";

const app = express();
app.use(cors());
app.use(express.json());

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

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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
