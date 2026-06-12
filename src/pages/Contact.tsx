import { HOURS, isOpenNow, WHATSAPP_URL } from "../components/Layout";

export function Contact() {
  const open = isOpenNow();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold text-espresso">Say hello</h1>
      <p className="mt-2 text-charcoal/70">Questions? Message us — we reply fast.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-3d block rounded-2xl bg-sage p-6 text-cream"
          >
            <p className="text-2xl">💬</p>
            <p className="mt-2 font-display text-xl font-bold">WhatsApp us</p>
            <p className="mt-1 text-sm opacity-80">The fastest way to reach the counter.</p>
          </a>
          <a
            href="tel:+15551234567"
            className="block rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <p className="text-2xl">📞</p>
            <p className="mt-2 font-display text-xl font-bold text-espresso">+1 (555) 123-4567</p>
            <p className="mt-1 text-sm text-charcoal/60">For bookings and big orders.</p>
          </a>
          <a
            href="mailto:hello@beanavenue.com"
            className="block rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <p className="text-2xl">✉️</p>
            <p className="mt-2 font-display text-xl font-bold text-espresso">hello@beanavenue.com</p>
            <p className="mt-1 text-sm text-charcoal/60">For everything else.</p>
          </a>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-display text-xl font-bold text-espresso">Visit us</p>
          <p className="mt-2 text-charcoal/80">123 Avenue Street, Your City</p>
          <span
            className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
              open ? "bg-sage/25 text-sage-dark" : "bg-terracotta/15 text-terracotta-dark"
            }`}
          >
            {open ? "● Open now" : "● Closed"}
          </span>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {HOURS.map((h) => (
                <tr key={h.day} className="border-b border-oat last:border-0">
                  <td className="py-1.5 font-medium">{h.day}</td>
                  <td className="py-1.5 text-right text-charcoal/70">
                    {h.open} – {h.close}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
