import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

const links = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/menu", label: "Menu Manager" },
  { to: "/admin/bookings", label: "Room Bookings" },
  { to: "/admin/rooms", label: "Rooms" },
  { to: "/admin/customers", label: "Customers & Loyalty" },
  { to: "/admin/reports", label: "Sales Reports" },
];

export function AdminLayout() {
  const { isAuthed, logout } = useAdminAuth();

  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  return (
    <div className="flex min-h-screen bg-oat/40">
      <aside className="hidden w-56 shrink-0 flex-col bg-espresso text-cream md:flex">
        <Link to="/" className="flex items-center gap-2 px-5 py-5">
          <img src="/bean.png" alt="" className="h-7 w-7 brightness-0 invert" />
          <span className="font-display text-xl font-bold">Bean Avenue</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Admin">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-mocha text-cream" : "text-oat hover:bg-mocha/60"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="m-3 rounded-lg px-3 py-2 text-left text-sm text-oat hover:bg-mocha/60"
        >
          Sign out
        </button>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-oat bg-cream px-4 py-3 md:hidden">
          <Link to="/admin" className="font-display text-lg font-bold text-espresso">
            Bean Avenue Admin
          </Link>
          <button onClick={logout} className="text-sm font-medium text-terracotta">
            Sign out
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-oat bg-cream px-2 py-2 md:hidden" aria-label="Admin mobile">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                  isActive ? "bg-espresso text-cream" : "bg-oat text-espresso"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
