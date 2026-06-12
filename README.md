# Bean Avenue — Frontend

The customer website + admin dashboard for Bean Avenue. *Brews, bonds and business.*

Built with **React 18 + TypeScript + Vite + Tailwind CSS v4** (mobile-first, 3D UI, brand palette: Brunswick green / champagne / orange / caramel).

## What's inside

- **Customer:** Home, Menu, Product Details, Cart, Checkout, Order Success, Rooms, Book a Room (live availability + live price), Booking Success, Loyalty ("Beans"), About, Contact
- **Admin** (`/admin`, auth-protected): Dashboard with room timeline, Orders, Menu Manager, Room Bookings, Rooms Management, Customers & Loyalty, Sales Reports with CSV export

## Requirements

- Node.js 18+
- The backend running on port 4000 → see the [Bean_Avenue_Backend](https://github.com/sabine-aa/Bean_Avenue_Backend) repo

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 — API calls to `/api/*` are proxied to the backend on `http://localhost:4000` (configured in `vite.config.ts`).

**Admin login:** http://localhost:5173/admin — `admin@beanavenue.com` / `beanavenue` (created by the backend seed).

## Build for production

```bash
npm run build   # type-checks then outputs dist/
```

## Project structure

```
src/
  main.tsx, App.tsx      entry + routes
  index.css              brand palette + 3D utilities (btn-3d, card-lift, float-bean)
  types.ts               shared API types
  lib/api.ts             fetch wrapper + formatters
  context/               Cart, Toast, AdminAuth providers
  components/            Layout (nav/footer), MenuItemCard, Img
  pages/                 customer-facing pages
  admin/                 admin dashboard pages
public/
  logo.png               full logo with tagline
  bean.png               bean emblem (also the favicon)
```
