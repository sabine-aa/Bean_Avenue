import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { ChevronDownIcon, InstagramIcon, MapPinIcon, PhoneIcon, UserIcon, WhatsAppIcon } from "./icons";
import { NotificationBell } from "./NotificationBell";

const ACCOUNT_LINKS = [
  { to: "/account", label: "My Account" },
  { to: "/account?tab=orders", label: "My Orders" },
  { to: "/account?tab=recent", label: "Recently Ordered" },
  { to: "/account?tab=rewards", label: "My Rewards" },
  { to: "/account?tab=bookings", label: "My Bookings" },
];

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/doughnuts", label: "Doughnuts" },
  { to: "/rooms", label: "Rooms" },
  { to: "/events", label: "Events" },
  { to: "/loyalty", label: "Loyalty" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

// ---- Bean Avenue contact details ----
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Open 7:00 AM – 12:00 AM (midnight), every day.
export const HOURS: { day: string; open: string; close: string }[] = DAYS.map((day) => ({
  day,
  open: "7:00 AM",
  close: "12:00 AM",
}));

// WhatsApp / phone (Lebanon, +961). wa.me + tel: use the full international form.
export const PHONE_DISPLAY = "+961 81 185 505";
export const PHONE_TEL = "+96181185505";
export const WHATSAPP_URL = "https://wa.me/96181185505?text=Hi%20Bean%20Avenue!";
export const INSTAGRAM_URL =
  "https://www.instagram.com/beanavenue.lb?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==";
export const ADDRESS = "Aley, Lebanon";
export const MAPS_LINK =
  "https://www.google.com/maps/search/?api=1&query=Bean%20Avenue%20Aley%20Lebanon";
export const MAPS_EMBED = "https://www.google.com/maps?q=Bean%20Avenue%20Aley%20Lebanon&output=embed";

export function isOpenNow(now = new Date()): boolean {
  // Open 7:00 AM until midnight, so closed only between midnight and 7 AM.
  return now.getHours() >= 7;
}

function ProfileMenu() {
  const { account, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!account) {
    return (
      <Link
        to="/loyalty"
        className="flex items-center gap-1.5 rounded-full border border-oat px-4 py-2 text-sm font-semibold text-espresso transition hover:bg-oat"
      >
        <UserIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Login</span>
      </Link>
    );
  }

  const firstName = account.name?.split(" ")[0] || "Account";
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-oat bg-white px-2 py-1.5 text-sm font-semibold text-espresso transition hover:bg-oat sm:px-3"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-espresso text-cream">
          <UserIcon className="h-4 w-4" />
        </span>
        <span className="hidden max-w-[8rem] truncate sm:block">{firstName}</span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-oat bg-white py-2 shadow-xl"
          role="menu"
        >
          <div className="border-b border-oat px-4 pb-2">
            <p className="font-semibold text-espresso">{account.name}</p>
            <p className="text-xs text-charcoal/50">
              {account.beanBalance} beans · {account.tier}
            </p>
          </div>
          {ACCOUNT_LINKS.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-charcoal transition hover:bg-oat/50"
              role="menuitem"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              logout();
              navigate("/");
            }}
            className="mt-1 block w-full border-t border-oat px-4 py-2 text-left text-sm font-semibold text-terracotta-dark transition hover:bg-oat/50"
            role="menuitem"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { count } = useCart();
  const { account, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-oat bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/bean.png" alt="" className="h-9 w-9 drop-shadow-md" />
            <span className="whitespace-nowrap font-display text-2xl font-bold text-espresso">
              Bean Avenue
            </span>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Main">
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

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/menu"
              className="btn-3d hidden whitespace-nowrap rounded-full bg-espresso px-4 py-2 text-sm font-semibold text-cream xl:block"
            >
              Order
            </Link>
            <Link
              to="/book"
              className="btn-3d hidden whitespace-nowrap rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream xl:block"
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
            {account && <NotificationBell />}
            <ProfileMenu />
            <button
              className="rounded-lg p-2 text-xl leading-none lg:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-oat px-4 py-3 lg:hidden" aria-label="Mobile">
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

              {/* Account section */}
              <div className="mt-1 border-t border-oat pt-3">
                {account ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-charcoal/40">
                      {account.name} · {account.beanBalance} beans
                    </p>
                    {ACCOUNT_LINKS.map((l) => (
                      <NavLink
                        key={l.label}
                        to={l.to}
                        onClick={() => setMenuOpen(false)}
                        className="block py-2 text-sm font-medium text-charcoal"
                      >
                        {l.label}
                      </NavLink>
                    ))}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                        navigate("/");
                      }}
                      className="mt-1 block w-full rounded-full bg-oat px-4 py-2 text-center text-sm font-semibold text-terracotta-dark"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    to="/loyalty"
                    onClick={() => setMenuOpen(false)}
                    className="block w-full rounded-full border border-oat px-4 py-2 text-center text-sm font-semibold text-espresso"
                  >
                    Login / Join
                  </Link>
                )}
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 bg-espresso text-cream">
        <div className="mx-auto grid max-w-6xl gap-x-8 gap-y-12 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/bean.png" alt="" className="h-9 w-9 brightness-0 invert" />
              <p className="font-display text-2xl font-bold">Bean Avenue</p>
            </div>
            <p className="mt-3 text-base text-oat">Brews, bonds and business.</p>
            <a
              href={MAPS_LINK}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-base text-oat transition hover:text-cream"
            >
              <MapPinIcon className="h-5 w-5 shrink-0 text-sage" />
              {ADDRESS}
            </a>
          </div>

          <div>
            <p className="font-display text-lg font-bold">Hours</p>
            <ul className="mt-4 space-y-2 text-base text-oat">
              {HOURS.map((h) => (
                <li key={h.day} className="flex items-baseline justify-between gap-4">
                  <span>{h.day}</span>
                  <span className="tabular-nums text-cream/90">
                    {h.open} – {h.close}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-display text-lg font-bold">Find your way</p>
            <ul className="mt-4 space-y-1 text-base text-oat">
              {[
                { to: "/menu", label: "Menu" },
                { to: "/rooms", label: "Rooms & Spaces" },
                { to: "/events", label: "Events & Workshops" },
                { to: "/loyalty", label: "Loyalty — earn beans" },
                { to: "/admin", label: "Staff login" },
              ].map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="-mx-2 block rounded-lg px-2 py-1.5 transition hover:bg-mocha/60 hover:text-cream">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-display text-lg font-bold">Say hello</p>
            <ul className="mt-4 space-y-1 text-base text-oat">
              <li>
                <a href={`tel:${PHONE_TEL}`} className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-mocha/60 hover:text-cream">
                  <PhoneIcon className="h-5 w-5 shrink-0 text-sage" />
                  {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-mocha/60 hover:text-cream">
                  <InstagramIcon className="h-5 w-5 shrink-0 text-sage" />
                  @beanavenue.lb
                </a>
              </li>
            </ul>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-3d mt-5 inline-flex items-center gap-2.5 rounded-full bg-sage px-6 py-3 text-base font-semibold text-cream"
            >
              <WhatsAppIcon className="h-5 w-5" />
              WhatsApp us
            </a>
          </div>
        </div>
        <div className="border-t border-mocha py-5 text-center text-sm text-oat">
          © {new Date().getFullYear()} Bean Avenue. Made with too much espresso.
        </div>
      </footer>
    </div>
  );
}
