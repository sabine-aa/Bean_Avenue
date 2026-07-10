# Bean Avenue — Multi-Branch ("McDonald's-style") Platform Plan

The goal: one brand, one website, many branches across countries. Customers pick
their location; each branch has its own menu, prices, currency and language; it's
all one system with per-country accounts/loyalty and an HQ dashboard.

---

## Locked decisions
1. **Customers reach a branch:** ONE domain (`beanavenue.com`) with a **location picker** + store map.
2. **Loyalty:** **per-country** (beans/accounts do not cross borders).
3. **Menu control:** **HQ sets a master template**, each **branch tweaks its own copy**.
4. **Database:** **per-country** (each country fully isolated — privacy/residency friendly).

---

## Architecture

```
   Customer ─▶  ONE website: beanavenue.com  (location picker + store map)
                          │  loads the directory of countries/branches
                 ┌────────▼─────────┐
                 │  Global Registry  │   ← the ONLY shared/global data
                 │ countries, branch │     (country → API URL, currency,
                 │ list, API URLs…   │      language, timezone, map pin)
                 └───┬───────────┬───┘
        pick Lebanon │           │ pick Qatar
        ┌────────────▼──┐   ┌────▼───────────┐
        │ Lebanon API+DB │   │  Qatar API+DB   │  ← per country, isolated
        │ branches:      │   │  branches: Doha │     (own customers + loyalty)
        │ Beirut, Jbeil… │   │                 │
        └────────────────┘   └─────────────────┘
                 ▲                    ▲
                 └──── HQ menu template ────┘
                  (seeds each new country/branch;
                   branches tweak their own copy)
```

### The pieces
- **One frontend (one domain):** shared code, single deploy. Loads the registry →
  shows the location picker/store map → then talks to the chosen **country's** API.
- **Global registry (only shared data):** a small directory of which countries and
  branches exist, each with API address, currency, language, timezone, map pin.
- **Per-country backend + database:** the full app (menu, orders, customers,
  loyalty, delivery) isolated per country. This is what makes loyalty + data
  per-country. A customer visiting two countries has two separate accounts.
- **Two levels inside a country — Country and Branch:** one country DB holds many
  stores. Menu/prices/availability are **per branch**; customers + beans are
  **shared across branches within that country**.
- **HQ menu template:** master menu (like the current `menu-data.ts`) that seeds a
  new country/branch; each branch then edits its own copy. HQ can optionally push
  new template items later without wiping local tweaks.
- **Admin roles:** **HQ/owner** (template, registry, create countries/branches,
  cross-country overview) and **Branch manager** (only their own menu + orders).

---

## Data model sketch

**Global registry** (tiny shared store or config service):
- `Country { code, name, apiBaseUrl, currency, currencySymbol, languages[], timezone, isLive }`
- `BranchDirectory { id, countryCode, name, city, address, lat, lng, isLive }`

**Per-country database** (each country its own DB — additions to today's schema):
- New `Branch { id, name, city, address, lat, lng, phone, hours, isActive }`
- Add `branchId` to: `MenuItem`, `Category`, add-on groups/assignments, `Order`,
  `DeliveryZone`, `Event`, `Reward`, `Banner`, per-branch `Setting`s.
- `Customer` + loyalty stay **country-level** (no branchId) → beans shared across
  that country's branches. `Order` carries `branchId`.

**HQ template** (source of truth for seeding):
- Versioned master menu + categories + add-ons (today's `menu-data.ts` becomes this).
- Used to seed a new country/branch; branch overrides live in that country's DB.

---

## How you add a location
- **New country:** provision a DB + backend (same idea as the salon template
  playbook), seed from the HQ template, add to the registry with currency /
  language / timezone, connect that country's payment + delivery. → new market live.
- **New branch in an existing country:** add a `Branch` row in that country's DB,
  copy the menu, assign a branch manager, list it on the registry/map. → new store
  in minutes.

---

## What's reused vs new
- **Reused:** the editable menu / categories / add-ons / orders / loyalty / delivery
  all carry over — they just gain a `branchId` inside each country DB.
- **New work:** global registry + location picker + store map; branch scoping inside
  a country; HQ template + seeding flow; branch-manager role; currency; Arabic/English
  (right-to-left).

---

## Phased roadmap (after the first store is live)
- **Phase 0 — Launch:** first store live on the current build (becomes "Lebanon → Beirut").
- **Phase 1 — Foundation:** move to hosted PostgreSQL; add the `Branch` model; make
  today's location "Branch #1." Built additively so the live store keeps working.
- **Phase 2 — Branch management:** HQ creates branches; branch-manager role; every
  query scoped to a branch.
- **Phase 3 — Customer side:** global registry + location picker + store-locator map;
  menu/prices/currency switch to the chosen branch; cart/checkout tied to it.
- **Phase 4 — Localization:** currency per branch; Arabic + English (RTL); timezone
  per branch (pattern already solved); per-country payment + tax + delivery.
- **Phase 5 — Loyalty/accounts:** per-country accounts + beans; rewards per branch.
- **Phase 6 — Scale:** HQ analytics across branches; smooth "onboard a franchise" flow.

---

## Reality check
This is a real, multi-phase rebuild (weeks, not a weekend). The per-country-database
decision keeps it clean — each country is simply its own box, so there's no risky
"don't leak data between tenants in one shared DB" problem. Nothing here blocks
launching the first store now; it becomes Branch #1 later with no menu rework.

---

_Last updated: 2026-07-10. Owner: Aneel. Decisions above are confirmed._
