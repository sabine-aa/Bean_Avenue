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
    <div className="bg-espresso flex min-h-screen items-center justify-center px-4">
      <div className="bg-cream w-full max-w-sm rounded-2xl p-8 shadow-2xl">
        <img src="/logo.png" alt="Bean Avenue" className="mx-auto w-56" />
        <p className="text-charcoal/60 mt-1 text-center text-sm">Staff sign-in</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-espresso block text-sm font-semibold" htmlFor="aemail">
              Email
            </label>
            <input
              id="aemail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-oat mt-1 w-full rounded-xl border bg-white px-4 py-2.5"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-espresso block text-sm font-semibold" htmlFor="apass">
              Password
            </label>
            <input
              id="apass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-oat mt-1 w-full rounded-xl border bg-white px-4 py-2.5"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-terracotta-dark text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="btn-3d bg-espresso text-cream w-full rounded-full px-6 py-3 font-semibold disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link to="/" className="text-charcoal/60 hover:text-terracotta mt-4 block text-center text-sm">
          ← Back to the café
        </Link>
      </div>
    </div>
  );
}
