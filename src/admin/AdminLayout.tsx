import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

type NavItem = { to: string; label: string; end?: boolean };
type NavGroup = { title: string; icon: string; items: NavItem[] };

// The one Main item lives above the collapsible groups as a standalone link.
const DASHBOARD: NavItem = { to: "/admin", label: "Dashboard", end: true };

const GROUPS: NavGroup[] = [
  {
    title: "Sales & Orders",
    icon: "🧾",
    items: [
      { to: "/admin/orders", label: "Orders" },
      { to: "/admin/reports", label: "Sales Reports" },
      { to: "/admin/payments", label: "Payments" },
      { to: "/admin/delivery", label: "Delivery" },
    ],
  },
  {
    title: "Menu & Products",
    icon: "☕",
    items: [
      { to: "/admin/menu", label: "Menu Manager" },
      { to: "/admin/addons", label: "Add-ons" },
      { to: "/admin/featured", label: "Featured Items" },
      { to: "/admin/banners", label: "Home Banner" },
    ],
  },
  {
    title: "Shop / Retail",
    icon: "🛍",
    items: [
      { to: "/admin/shop-products", label: "Shop Products" },
      { to: "/admin/preorders", label: "Preorders" },
      { to: "/admin/inventory", label: "Retail Product Stock" },
    ],
  },
  {
    title: "Hanson Doughnuts",
    icon: "🍩",
    items: [
      { to: "/admin/doughnuts", label: "Doughnut Products" },
      { to: "/admin/hanson-production", label: "Daily Production" },
      { to: "/admin/hanson-reports", label: "Hanson Reports" },
    ],
  },
  {
    title: "Rooms",
    icon: "🛎",
    items: [
      { to: "/admin/bookings", label: "Room Bookings" },
      { to: "/admin/rooms", label: "Rooms" },
    ],
  },
  {
    title: "Customers & Loyalty",
    icon: "👥",
    items: [
      { to: "/admin/customers", label: "Customers" },
      { to: "/admin/rewards", label: "Rewards" },
      { to: "/admin/birthday", label: "Birthday Rewards" },
      { to: "/admin/loyalty", label: "Loyalty Points" },
    ],
  },
  {
    title: "Inventory",
    icon: "📦",
    items: [
      { to: "/admin/stock", label: "Ingredients Inventory" },
      { to: "/admin/restock", label: "Restock / Receiving" },
      { to: "/admin/suppliers", label: "Suppliers" },
      { to: "/admin/recipes", label: "Recipes" },
      { to: "/admin/low-stock", label: "Low Stock Alerts" },
      { to: "/admin/import", label: "Import from Excel" },
    ],
  },
  {
    title: "Events & Marketing",
    icon: "🎉",
    items: [
      { to: "/admin/events", label: "Events" },
      { to: "/admin/event-suggestions", label: "Event Ideas & Voting" },
      { to: "/admin/subscribers", label: "Offer Signups" },
      { to: "/admin/suggestions", label: "Suggestions" },
    ],
  },
  {
    title: "Staff & Register",
    icon: "⏱",
    items: [
      { to: "/admin/staff", label: "Staff & PINs" },
      { to: "/admin/timesheets", label: "Staff Timesheets" },
      { to: "/admin/shifts", label: "Shifts / Cash Drawer" },
    ],
  },
  {
    title: "System",
    icon: "🛡",
    items: [{ to: "/admin/activity", label: "Activity Log" }],
  },
];

// Most-used one-tap actions, kept out of the grouped list so it stays clean.
const QUICK = [
  { to: "/admin/menu", label: "+ Product" },
  { to: "/admin/restock", label: "+ Restock" },
  { to: "/book", label: "Book Room" },
];

const itemIsActive = (pathname: string, to: string) => pathname === to || pathname.startsWith(to + "/");
const activeGroupTitle = (pathname: string) => GROUPS.find((g) => g.items.some((i) => itemIsActive(pathname, i.to)))?.title ?? null;

// The sidebar body — shared by the desktop rail and the mobile drawer.
function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const active = activeGroupTitle(pathname);
    return active ? { [active]: true } : {};
  });

  // Keep the section you're in expanded as you move around.
  useEffect(() => {
    const active = activeGroupTitle(pathname);
    if (active) setOpen((o) => (o[active] ? o : { ...o, [active]: true }));
  }, [pathname]);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-mocha text-cream" : "text-oat hover:bg-mocha/60"}`;

  return (
    <>
      {/* Quick actions */}
      <div className="mb-3 space-y-2">
        <Link
          to="/pos"
          onClick={onNavigate}
          className="bg-terracotta text-cream hover:bg-terracotta-dark block rounded-lg px-3 py-2.5 text-center text-sm font-bold transition"
        >
          🧾 Open Register
        </Link>
        <Link
          to="/kds"
          onClick={onNavigate}
          className="bg-mocha text-cream hover:bg-mocha/80 block rounded-lg px-3 py-2 text-center text-sm font-bold transition"
        >
          🍳 Kitchen Display
        </Link>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <Link
              key={q.label}
              to={q.to}
              onClick={onNavigate}
              className="border-oat/30 text-oat hover:bg-mocha/60 rounded-full border px-2.5 py-1 text-xs font-semibold transition"
            >
              {q.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main */}
      <NavLink to={DASHBOARD.to} end={DASHBOARD.end} onClick={onNavigate} className={linkCls}>
        🏠 Dashboard
      </NavLink>

      {/* Collapsible groups */}
      <nav className="mt-2 flex flex-col gap-0.5" aria-label="Admin sections">
        {GROUPS.map((g) => {
          const isOpen = !!open[g.title];
          const hasActive = g.items.some((i) => itemIsActive(pathname, i.to));
          return (
            <div key={g.title}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.title]: !o[g.title] }))}
                className={`hover:bg-mocha/40 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold tracking-wide uppercase transition ${
                  hasActive ? "text-cream" : "text-oat/60"
                }`}
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">{g.icon}</span>
                  {g.title}
                  {hasActive && !isOpen && <span className="bg-terracotta h-1.5 w-1.5 rounded-full" />}
                </span>
                <span className={`text-base leading-none transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
              </button>
              {isOpen && (
                <div className="border-mocha/50 mb-1 ml-2 space-y-0.5 border-l pl-2">
                  {g.items.map((i) => (
                    <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate} className={linkCls}>
                      {i.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}

export function AdminLayout() {
  const { isAuthed, logout } = useAdminAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  return (
    <div className="bg-oat/40 flex min-h-screen">
      {/* Desktop rail — sticky, internally scrollable */}
      <aside className="bg-espresso text-cream sticky top-0 hidden h-screen w-60 shrink-0 flex-col md:flex">
        <Link to="/" className="flex items-center gap-2 px-5 py-4">
          <img src="/bean.png" alt="" className="h-7 w-7 brightness-0 invert" />
          <span className="font-display text-xl font-bold">Bean Avenue</span>
        </Link>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <AdminNav />
        </div>
        <button onClick={logout} className="border-mocha/50 text-oat hover:bg-mocha/60 m-3 rounded-lg border-t px-3 py-2 text-left text-sm">
          Sign out
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="border-oat bg-cream sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-espresso hover:bg-oat/60 flex items-center gap-2 rounded-lg px-2 py-1.5"
            aria-label="Open admin menu"
          >
            <span className="text-xl leading-none">☰</span>
            <span className="font-display text-lg font-bold">Admin</span>
          </button>
          <button onClick={logout} className="text-terracotta text-sm font-medium">
            Sign out
          </button>
        </header>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <div className="bg-espresso text-cream absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4">
                <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <img src="/bean.png" alt="" className="h-7 w-7 brightness-0 invert" />
                  <span className="font-display text-xl font-bold">Bean Avenue</span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-oat hover:bg-mocha/60 rounded-lg p-1.5 text-xl leading-none"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                <AdminNav onNavigate={() => setMobileOpen(false)} />
              </div>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="border-mocha/50 text-oat hover:bg-mocha/60 m-3 rounded-lg border-t px-3 py-2 text-left text-sm"
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
