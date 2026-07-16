# Bean Avenue — CLAUDE.md

## What this is
Full platform for Bean Avenue, a café + bookable study/conference rooms in
Aley, Lebanon: online menu ordering (pickup/delivery), room booking, loyalty
("beans"), events, retail shop (illy), Hanson Doughnuts corner, POS + KDS for
staff, and a large admin. Direction: multi-branch platform (MULTI-BRANCH-PLAN.md).

## Stack & layout  (⚠ web app is at the REPO ROOT, server in server/)
- Root: Vite + React 18 + Tailwind v4 + PWA — port 5173
- server/ (Express + Prisma + Neon Postgres) — port 4000
- GitHub: sabine-aa/Bean_Avenue — work happens on a feature branch,
  deploys push with `git push origin HEAD:main`

## Deploys
- API → Render (root server/), auto-builds on push to main:
  https://beanavenue-api.onrender.com (free tier: ~40s cold start,
  no outbound SMTP → email via Resend HTTP)
- Web → Cloudflare Worker `beanavenue`: `npm run build && npx wrangler deploy`
  (NOT automatic — run it for any user-visible web change)
- Verify prod: /api/health → 200. Hard-refresh needed (PWA caches).

## Commands
- Dev: `cd server && npm run dev` (API) + `npm run dev` (web, at root)
- Typecheck: `npx tsc -b --noEmit` (root) and `npx tsc --noEmit` (server/)
- Format: `npm run format` · Lint: `npm run lint`
- DB: Neon Postgres (migrated OFF SQLite). `prisma db push` may hit P1001
  while Neon wakes — retry. OneDrive can EPERM-lock the Prisma DLL.

## Brand
- Warm café palette in src/index.css @theme: espresso/mocha browns, cream/oat,
  terracotta accent, sage. Serif display; friendly, cozy voice.
- Hanson Doughnuts sections use the BLACK Hanson identity + orange accent.

## Domain rules (get these right)
- Images: uploads are stored IN the DB (Upload model) and served from
  /api/uploads/<name> — never write uploads to Render's ephemeral disk.
  Curated shop/doughnut photos are committed static assets in public/photos.
- Two separate PWAs: customer app (root manifest) vs POS app (/pos +
  pos.webmanifest) — ManifestSwitcher swaps them by route; don't mix.
- Payments: mock gateway for online payment (delivery), refunds + loyalty
  correction flows exist. POS is PIN-gated; admin has its own login; /kds is
  deliberately open (kitchen screen).
- Loyalty: 1 bean per $1 on coffee AND rooms. Birthday reward = free cupcake/yr.
- Inventory: ingredient/recipe (BOM) auto-deduction on completion (café),
  plus separate Shop stock (illy retail) and Hanson daily-production stock.
- Scroll: global ScrollToTop + manual scrollRestoration — pages always open
  at the top (owner preference).

## Current status / next up
- LIVE in production. Launch blockers tracked in memory: RESEND_API_KEY on
  Render (email delivery), connect beanavenue.com domain.
- Direction: McDonald's-style multi-branch (launch store #1, then platformize).
