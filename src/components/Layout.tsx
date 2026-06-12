import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useCart } from "../context/CartContext";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/rooms", label: "Rooms" },
  { to: "/loyalty", label: "Loyalty" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export const HOURS: { day: string; open: string; close: string }[] = [
  { day: "Monday", open: "8:00 AM", close: "10:00 PM" },
  { day: "Tuesday", open: "8:00 AM", close: "10:00 PM" },
  { day: "Wednesday", open: "8:00 AM", close: "10:00 PM" },
  { day: "Thursday", open: "8:00 AM", close: "10:00 PM" },
  { day: "Friday", open: "8:00 AM", close: "11:00 PM" },
  { day: "Saturday", open: "9:00 AM", close: "11:00 PM" },
  { day: "Sunday", open: "9:00 AM", close: "9:00 PM" },
];

export const WHATSAPP_URL = "https://wa.me/15551234567?text=Hi%20Bean%20Avenue!";

export function isOpenNow(now = new Date()): boolean {
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours();
  if (day === 0) return hour >= 9 && hour < 21;
  if (day === 5) return hour >= 8 && hour < 23;
  if (day === 6) return hour >= 9 && hour < 23;
  return hour >= 8 && hour < 22;
}

export function Layout() {
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-oat bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/bean.png" alt="" className="h-9 w-9 drop-shadow-md" />
            <span className="font-display text-2xl font-bold text-espresso">Bean Avenue</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-terracotta ${
                    isActive ? "text-terracotta" : "text-charcoal"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/menu"
              className="btn-3d hidden rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-cream sm:block"
            >
              Order
            </Link>
            <Link
              to="/book"
              className="btn-3d hidden rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream sm:block"
            >
              Book a Room
            </Link>
            <Link
              to="/cart"
              aria-label={`Cart, ${count} items`}
              className="relative rounded-full p-2 text-xl transition hover:bg-oat"
            >
              🛒
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-xs font-bold text-cream">
                  {count}
                </span>
              )}
            </Link>
            <button
              className="rounded-lg p-2 text-xl md:hidden"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ☰
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-oat px-4 py-3 md:hidden" aria-label="Mobile">
            <div className="flex flex-col gap-3">
              {navLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium"
                >
                  {l.label}
                </NavLink>
              ))}
              <div className="flex gap-2 pt-1">
                <Link
                  to="/menu"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-full bg-espresso px-4 py-2 text-center text-sm font-semibold text-cream"
                >
                  Order
                </Link>
                <Link
                  to="/book"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-full bg-terracotta px-4 py-2 text-center text-sm font-semibold text-cream"
                >
                  Book a Room
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 bg-espresso text-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <img src="/bean.png" alt="" className="h-8 w-8 brightness-0 invert" />
              <p className="font-display text-xl font-bold">Bean Avenue</p>
            </div>
            <p className="mt-2 text-sm text-oat">Brews, bonds and business.</p>
            <p className="mt-4 text-sm text-oat">
              123 Avenue Street
              <br />
              Your City
            </p>
            <a
              href="https://www.google.com/maps/search/?api=1&query=cafe"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-sage underline-offset-2 hover:underline"
            >
              Open in Maps →
            </a>
          </div>
          <div>
            <p className="font-semibold">Hours</p>
            <ul className="mt-3 space-y-1 text-sm text-oat">
              {HOURS.map((h) => (
                <li key={h.day} className="flex justify-between gap-4">
                  <span>{h.day}</span>
                  <span>
                    {h.open} – {h.close}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold">Find your way</p>
            <ul className="mt-3 space-y-2 text-sm text-oat">
              <li><Link to="/menu" className="hover:text-cream">Menu</Link></li>
              <li><Link to="/rooms" className="hover:text-cream">Rooms & Spaces</Link></li>
              <li><Link to="/loyalty" className="hover:text-cream">Loyalty — earn beans</Link></li>
              <li><Link to="/admin" className="hover:text-cream">Staff login</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Say hello</p>
            <ul className="mt-3 space-y-2 text-sm text-oat">
              <li>
                <a href="tel:+15551234567" className="hover:text-cream">+1 (555) 123-4567</a>
              </li>
              <li>
                <a href="mailto:hello@beanavenue.com" className="hover:text-cream">hello@beanavenue.com</a>
              </li>
            </ul>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-3d mt-4 inline-block rounded-full bg-sage px-5 py-2 text-sm font-semibold text-cream"
            >
              💬 WhatsApp us
            </a>
          </div>
        </div>
        <div className="border-t border-mocha py-4 text-center text-xs text-oat">
          © {new Date().getFullYear()} Bean Avenue. Made with too much espresso.
        </div>
      </footer>
    </div>
  );
}
