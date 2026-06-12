import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

export function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-espresso px-4">
      <div className="w-full max-w-sm rounded-2xl bg-cream p-8 shadow-2xl">
        <img src="/logo.png" alt="Bean Avenue" className="mx-auto w-56" />
        <p className="mt-1 text-center text-sm text-charcoal/60">Staff sign-in</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-espresso" htmlFor="aemail">
              Email
            </label>
            <input
              id="aemail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-espresso" htmlFor="apass">
              Password
            </label>
            <input
              id="apass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-oat bg-white px-4 py-2.5"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-terracotta-dark">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="btn-3d w-full rounded-full bg-espresso px-6 py-3 font-semibold text-cream disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link to="/" className="mt-4 block text-center text-sm text-charcoal/60 hover:text-terracotta">
          ← Back to the café
        </Link>
      </div>
    </div>
  );
}
