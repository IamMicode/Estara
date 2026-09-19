import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase, friendlyError, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth, homeRouteFor } from "../../lib/AuthContext";
import {
  agentRegisterSchema,
  customerRegisterSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  validate,
} from "../../lib/validation";
import { Alert, Field, Spinner } from "../components/ui";

/* --------------------------------------------------------------- layout ---- */

function AuthShell({
  children,
  quote,
  image,
}: {
  children: React.ReactNode;
  quote: string;
  image: string;
}) {
  return (
    <div className="app-root">
      <div className="auth-shell">
        <aside className="auth-aside">
          <div className="auth-aside__bg" style={{ backgroundImage: `url(${image})` }} />
          <Link to="/" className="auth-aside__brand">
            ESTARA
          </Link>
          <p className="auth-aside__quote">{quote}</p>
          <p className="auth-aside__foot">Where places become possibilities.</p>
        </aside>
        <main className="auth-main">
          <div className="auth-card">{children}</div>
        </main>
      </div>
    </div>
  );
}

const HERO_A = "/properties/atlantic-villa.jpg";
const HERO_B = "/properties/vineyard-estate.jpg";
const HERO_C = "/properties/city-apartment.jpg";

function ConfigNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <Alert kind="warn">
        No database is connected yet, so accounts can't be created. Add your Supabase URL and anon
        key to <code>.env.local</code> — see <code>supabase/README.md</code>.
      </Alert>
    </div>
  );
}

/* ---------------------------------------------------------------- login ---- */

export function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const v = validate(loginSchema, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) throw error;

      const { data } = await supabase.auth.getUser();
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_user_id", data.user?.id ?? "")
        .maybeSingle();
      await refresh();
      nav(loc.state?.from ?? homeRouteFor((prof as { role: never })?.role ?? null), { replace: true });
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell quote="Welcome back. Your next place is waiting." image={HERO_A}>
      <h1>Sign in</h1>
      <p className="auth-card__sub">Continue to your Estara account.</p>
      <ConfigNotice />
      {serverError && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Email" error={errors.email}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>
        <div className="row row--between">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => setForm({ ...form, remember: e.target.checked })}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="link-quiet">
            Forgot password?
          </Link>
        </div>
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? <Spinner /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-alt">
        New to Estara? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}

/* ------------------------------------------------------- role selection ---- */

export function RegisterChoicePage() {
  return (
    <AuthShell quote="Two ways in. One place to begin." image={HERO_B}>
      <h1>Create your account</h1>
      <p className="auth-card__sub">Tell us how you'll use Estara.</p>
      <div className="stack">
        <Link to="/register/customer" className="card card--pad" style={{ display: "block" }}>
          <span className="eyebrow">I'm looking for a home</span>
          <h2 style={{ fontSize: 20, margin: "8px 0 6px" }}>Continue as a Customer</h2>
          <p className="muted">
            Discover homes, apartments, land and spaces, save favourites and contact agents.
          </p>
        </Link>
        <Link to="/register/agent" className="card card--pad" style={{ display: "block" }}>
          <span className="eyebrow">I'm listing a property</span>
          <h2 style={{ fontSize: 20, margin: "8px 0 6px" }}>Continue as an Agent</h2>
          <p className="muted">
            Create listings, manage inquiries and put your properties in front of buyers.
          </p>
        </Link>
      </div>
      <p className="auth-alt">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}

/* ------------------------------------------------------------- register ---- */

function useRegister(role: "customer" | "agent") {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const run = async (payload: Record<string, string>) => {
    setServerError("");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email.trim(),
        password: payload.password,
        options: {
          // The database trigger reads these to build the profile + agent row.
          data: {
            role,
            first_name: payload.first_name.trim(),
            last_name: payload.last_name.trim(),
            phone: payload.phone?.trim() || null,
            ...(role === "agent" ? { agency_name: payload.agency_name.trim() } : {}),
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;

      if (!data.session) {
        // Email confirmation is enabled on the project.
        setConfirmSent(true);
        return;
      }
      await refresh();
      nav(role === "agent" ? "/agent/verification" : "/customer/dashboard", { replace: true });
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return { errors, setErrors, serverError, busy, run, confirmSent };
}

function ConfirmSent({ email }: { email: string }) {
  return (
    <>
      <h1>Check your inbox</h1>
      <p className="auth-card__sub">
        We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account,
        then sign in.
      </p>
      <Link to="/login" className="btn btn--primary btn--block">
        Go to sign in
      </Link>
    </>
  );
}

export function CustomerRegisterPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const { errors, setErrors, serverError, busy, run, confirmSent } = useRegister("customer");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(customerRegisterSchema, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    await run(form);
  };

  return (
    <AuthShell quote="Find the place that feels right." image={HERO_C}>
      {confirmSent ? (
        <ConfirmSent email={form.email} />
      ) : (
        <>
          <h1>Create your account</h1>
          <p className="auth-card__sub">Save properties, contact agents and track your search.</p>
          <ConfigNotice />
          {serverError && (
            <div style={{ marginBottom: 16 }}>
              <Alert kind="error">{serverError}</Alert>
            </div>
          )}
          <form className="form" onSubmit={submit} noValidate>
            <div className="form-row">
              <Field label="First name" error={errors.first_name}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    autoComplete="given-name"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Last name" error={errors.last_name}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    autoComplete="family-name"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label="Email" error={errors.email}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              )}
            </Field>
            <Field label="Phone" error={errors.phone} hint="Optional, but helps agents reach you.">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+234 800 000 0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              )}
            </Field>
            <div className="form-row">
              <Field label="Password" error={errors.password} hint="At least 8 characters.">
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Confirm password" error={errors.confirm}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <button className="btn btn--primary btn--block" disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="auth-alt">
            Listing a property instead? <Link to="/register/agent">Register as an agent</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

export function AgentRegisterPage() {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    agency_name: "",
    password: "",
    confirm: "",
  });
  const { errors, setErrors, serverError, busy, run, confirmSent } = useRegister("agent");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(agentRegisterSchema, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    await run(form);
  };

  return (
    <AuthShell quote="Put your properties in front of people who are looking." image={HERO_B}>
      {confirmSent ? (
        <ConfirmSent email={form.email} />
      ) : (
        <>
          <h1>Create an agent account</h1>
          <p className="auth-card__sub">
            List properties and manage inquiries. Your account goes through verification before you
            can publish.
          </p>
          <ConfigNotice />
          {serverError && (
            <div style={{ marginBottom: 16 }}>
              <Alert kind="error">{serverError}</Alert>
            </div>
          )}
          <form className="form" onSubmit={submit} noValidate>
            <div className="form-row">
              <Field label="First name" error={errors.first_name}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    autoComplete="given-name"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Last name" error={errors.last_name}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    autoComplete="family-name"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <Field label="Agency name" error={errors.agency_name}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  autoComplete="organization"
                  placeholder="e.g. Adeyemi Property Partners"
                  value={form.agency_name}
                  onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Email" error={errors.email}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              )}
            </Field>
            <Field label="Phone" error={errors.phone}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+234 800 000 0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              )}
            </Field>
            <div className="form-row">
              <Field label="Password" error={errors.password} hint="At least 8 characters.">
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Confirm password" error={errors.confirm}>
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  />
                )}
              </Field>
            </div>
            <button className="btn btn--primary btn--block" disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy ? "Creating account…" : "Create agent account"}
            </button>
          </form>
          <p className="auth-alt">
            Looking for a home instead? <Link to="/register/customer">Register as a customer</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

/* ------------------------------------------------------ password recovery -- */

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(forgotPasswordSchema, { email });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    setServerError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell quote="Every journey starts somewhere." image={HERO_A}>
      {sent ? (
        <>
          <h1>Check your email</h1>
          <p className="auth-card__sub">
            If an account exists for <strong>{email}</strong>, we've sent a link to reset your
            password.
          </p>
          <Link to="/login" className="btn btn--primary btn--block">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <h1>Reset your password</h1>
          <p className="auth-card__sub">We'll email you a secure link to set a new one.</p>
          {serverError && (
            <div style={{ marginBottom: 16 }}>
              <Alert kind="error">{serverError}</Alert>
            </div>
          )}
          <form className="form" onSubmit={submit} noValidate>
            <Field label="Email" error={errors.email}>
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <button className="btn btn--primary btn--block" disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
          <p className="auth-alt">
            <Link to="/login">Back to sign in</Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(resetPasswordSchema, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    setServerError("");
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => nav("/login", { replace: true }), 1800);
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const hasRecovery =
    params.get("type") === "recovery" || window.location.hash.includes("access_token");

  return (
    <AuthShell quote="A place of your own." image={HERO_C}>
      <h1>Set a new password</h1>
      <p className="auth-card__sub">Choose something you haven't used before.</p>
      {!hasRecovery && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="info">
            Open this page from the reset link in your email so we can verify it's you.
          </Alert>
        </div>
      )}
      {done && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="success">Password updated. Taking you to sign in…</Alert>
        </div>
      )}
      {serverError && (
        <div style={{ marginBottom: 16 }}>
          <Alert kind="error">{serverError}</Alert>
        </div>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <Field label="New password" error={errors.password} hint="At least 8 characters.">
          {(p) => (
            <input
              {...p}
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          )}
        </Field>
        <button className="btn btn--primary btn--block" disabled={busy || done}>
          {busy ? <Spinner /> : null}
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
