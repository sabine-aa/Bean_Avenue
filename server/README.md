# Bean Avenue — Backend API

A small Node + Express + Prisma server that stores all of Bean Avenue's data
(menu, rooms, orders, bookings, customers, loyalty) in a database.

- **Local development:** SQLite (a single `dev.db` file — no setup needed).
- **Production later:** switch to hosted PostgreSQL by editing one line (see below).

## Running it (local)

You need **two terminals** running at the same time:

**Terminal 1 — the backend (this folder):**
```bash
cd server
npm install        # first time only
npm run db:push    # first time only — creates the database tables
npm run seed       # first time only — fills it with the menu + rooms
npm run dev        # starts the API on http://localhost:4000
```

**Terminal 2 — the website (project root):**
```bash
npm run dev        # starts the site on http://localhost:5173
```

Open http://localhost:5173. The site talks to the API automatically (Vite
proxies `/api` → `http://localhost:4000`).

## Admin panel

Sign in at http://localhost:5173/admin with the credentials in `.env`:

- Email: `admin@beanavenue.com`
- Password: `beanavenue`

(Change these in `server/.env` — and set a real `JWT_SECRET` — before going live.)

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the API (auto-reloads on changes) |
| `npm run seed` | Reset the menu + rooms to the seed data (wipes orders/bookings/customers) |
| `npm run db:studio` | Open Prisma Studio — a visual editor for the database |
| `npm run db:push` | Apply schema changes to the database |

## Moving to a hosted database later

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
2. In `.env`, set `DATABASE_URL` to your PostgreSQL connection string.
3. Run `npm run db:push` then `npm run seed`.

No application code needs to change — Prisma handles the difference.
