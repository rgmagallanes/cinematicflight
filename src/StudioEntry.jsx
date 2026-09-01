import { useEffect, useRef, useState } from "react";
import { ArrowRight, LockKey, LockSimple } from "@phosphor-icons/react";
import { SalesDashboard } from "./SalesDashboard.jsx";
import { getApiStatus, getSession, login, logout } from "./lib/hostingerApi.js";

function StudioLogin({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState({ status: "idle", message: "" });

  const signIn = async (event) => {
    event.preventDefault();
    setState({ status: "loading", message: "Opening your private workspace…" });
    try {
      const user = await login(email.trim(), password);
      onAuthenticated(user);
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  };

  return (
    <main className="studio-login">
      <section className="studio-login-panel">
        <img src="/assets/brand/cinematic-flight-logo-concept-v1.png" alt="Cinematic Flight" />
        <div className="studio-login-lock"><LockSimple size={25} weight="bold" /><span>Private Studio</span></div>
        <h1>Enter your sales workspace.</h1>
        <p>Sign in with the Studio account stored securely in your Hostinger database.</p>
        <form onSubmit={signIn}>
          <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@cinematicflight.com" /></label>
          <label>Password<input type="password" required minLength="12" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="primary-action" type="submit" disabled={state.status === "loading"}><LockKey size={18} />{state.status === "loading" ? "Opening…" : "Enter Studio"}<ArrowRight size={17} /></button>
        </form>
        {state.message && <p className={`studio-login-status is-${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
      </section>
    </main>
  );
}

function StudioUnavailable() {
  return (
    <main className="studio-login">
      <section className="studio-login-panel studio-unavailable" role="alert">
        <div className="studio-login-lock"><LockSimple size={25} weight="bold" /><span>Studio locked</span></div>
        <h1>The database connection needs attention.</h1>
        <p>Check the private Hostinger API configuration and database connection, then refresh this page. Cached Studio data will not be shown while the production API is unavailable.</p>
      </section>
    </main>
  );
}

export function StudioEntry() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("checking");
  const reviewWorkStore = useRef({});

  useEffect(() => {
    let active = true;
    getApiStatus().then(async ({ available, configured }) => {
      if (!active) return;
      if (!available) { setMode("local"); return; }
      if (!configured) { setMode("unavailable"); return; }
      try {
        const currentUser = await getSession();
        if (active) { setUser(currentUser); setMode("api"); }
      } catch {
        if (active) setMode("unavailable");
      }
    });
    return () => { active = false; };
  }, []);

  if (mode === "checking") return <main className="studio-login"><div className="studio-auth-loading" role="status">Opening Studio…</div></main>;
  if (mode === "local") return <SalesDashboard />;
  if (mode === "unavailable") return <StudioUnavailable />;
  if (!user) return <StudioLogin onAuthenticated={setUser} />;
  return <SalesDashboard cloudUser={user} reviewWorkStore={reviewWorkStore} onSessionExpired={() => setUser(null)} onSignOut={async () => {
    try { await logout(); }
    finally { setUser(null); }
  }} />;
}
