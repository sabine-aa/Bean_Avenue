# Bean Avenue — POS (Point of Sale) Plan

The goal: a full in-store **cashier/register** built into the **same system as the
website** — so online orders, in-store sales, loyalty, inventory and reports are
ONE unified platform. Replaces the standalone POS (Bimpos) with something that
also powers the website and knows every customer.

---

## Why we're already halfway there
The hard foundation exists. The POS is a new fast **register screen** on top of it.

Already built & reusable:
- **Product catalog** — menu, categories, sizes, add-ons
- **Orders engine** + **Payments** ledger
- **Customers + loyalty (beans)**
- **Cloud backend + database + admin**
- Partial **reports**
- A **cash-drawer / day-close** pattern (already built for the RiwaGlam salon)

## The advantage over Bimpos (one system, not a separate box)
- Website + register + loyalty + inventory + reports **share the same data**.
- Customers earn/redeem **beans whether they order online OR at the counter**.
- **One menu** — change a price once, it updates online *and* in-store.
- **One set of reports** across every channel.
- Runs on **cheap tablets**, not expensive proprietary terminals.
- You **own the system + data** — no per-terminal license fees.

---

## Modules to build
1. **Register / cashier screen** — tap items → build the order fast → pay. Touch-first, categories + search + quick keys, modifiers (size/add-ons), quantity, notes.
2. **Order types** — dine-in / takeaway (delivery already handled online). Optional table selection.
3. **Payments** — cash (with change calc), card, **split payment**, discounts (% or amount), voids/refunds, redeem **beans** / promo codes.
4. **Receipts** — thermal print (customer + kitchen); optional email/SMS receipt (reuses order infra).
5. **Kitchen / Bar Display (KDS)** — new orders pop up for staff; mark preparing/ready. Online + in-store orders in **one queue**.
6. **Shift & cash drawer** — clock in/out, open/close shift, starting float, cash count, expected vs actual, **Z-report** (RiwaGlam pattern exists).
7. **Staff accounts & permissions** — cashiers log in with a PIN, roles, who-sold-what.
8. **Live reports** — sales by day/shift/staff/item/category, payment breakdown, hourly, X/Z reports.
9. **Inventory (optional, deeper)** — stock deducted per sale, low-stock alerts, recipe/ingredient costing (RiwaGlam has this).
10. **Offline mode** — keep selling with no internet; queue and sync when back online.

---

## Hardware (cheap + flexible)
- **Terminal:** an Android tablet / iPad / cheap Windows touchscreen running the web app **full-screen (PWA)** — far cheaper than proprietary POS hardware.
- **Receipt printer:** a thermal printer (Epson TM-series / generic 80mm). Easiest via a **network (LAN)** printer or a small local print agent.
- **Cash drawer:** opens automatically via the receipt printer (kick-out cable).
- **Card reader:** a standalone bank terminal (enter total manually) to start, or an integrated terminal later if your processor offers an API/SDK.
- **Optional:** barcode scanner (packaged goods), a second tablet as the kitchen display.

---

## The hard parts (be realistic)
1. **Offline-first** — a POS can't stop selling when the WiFi drops. Needs local storage, queued sales and sync-on-reconnect. This is the biggest engineering effort.
2. **Reliability** — mission-critical during service; needs heavy testing, zero glitches.
3. **Card integration** — integrating a real card terminal is processor-specific and can be its own project. Manual entry (record amount, charge on the bank terminal) is the simple start.
4. **Printing** — thermal printing from a tablet needs the right setup (LAN printer or print agent).
5. **Multi-terminal sync** — multiple registers must stay in sync via shared cloud state.

---

## Data model additions
Reuse: `MenuItem`, `Order`, `OrderItem`, `Payment`, `Customer`, loyalty. Add:
- **Terminal/Register** (which till/device), **Shift** (open/close, float, counts), **StaffUser** (PIN, role) — or extend the existing staff/admin.
- In-store sale = an `Order` with `channel="POS"`; payment splits on `Payment`.
- **CashMovement** (pay-ins/outs, drawer).
- Scoped by `branchId` when the multi-branch platform lands (ties into MULTI-BRANCH-PLAN.md).

---

## Phased roadmap
- **Phase 1 — Core register:** tap-to-add, modifiers, cash payment + change, print/email receipt, basic sales report. *(Already a usable counter POS.)*
- **Phase 2 — Shift & drawer:** PIN login, open/close shift, cash reconciliation, Z-report.
- **Phase 3 — Kitchen display + order types**, unified online + in-store queue.
- **Phase 4 — Offline mode** (sell without internet, auto-sync).
- **Phase 5 — Card terminal integration** + split/refund/void polish.
- **Phase 6 — Deeper inventory** (stock per sale, alerts, costing) + multi-terminal + multi-branch scoping.

---

## What it replaces from Bimpos
Register, receipts, cash drawer/shift reports, item + staff sales — **plus things Bimpos doesn't do:** your website ordering, online loyalty, and one unified menu + reports across online *and* in-store.

## How it fits the other plans
- Runs on the **same backend** as the website.
- Scopes cleanly **per branch** once the multi-branch platform lands.
- **Loyalty is shared** — counter sales earn/redeem beans just like online.

---

## Reality + recommendation
A **big, multi-week build** (comparable to the multi-branch platform). Do ONE major initiative at a time. Suggested order:
1. **Launch the website** (nearly done — one Render upgrade from real email).
2. Pick **multi-branch OR POS** as the next big rock.
3. Build in phases. **Phase 1 alone is a working counter POS**; offline + card are later hardening.

## Decisions to make
1. **Hardware** — which tablets (Android / iPad / Windows)? Which receipt printer?
2. **Card** — manual entry to start, or integrate a terminal (which processor/bank)?
3. **Dine-in tables** needed, or just takeaway/counter?
4. **Priority vs the multi-branch platform** — which first?

---

_Last updated: 2026-07-10. Owner: Aneel. Status: plan only — not built yet._
