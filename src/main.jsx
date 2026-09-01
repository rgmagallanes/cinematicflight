import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import "./dashboard.css";

const isStudioHostname = window.location.hostname.toLowerCase() === "studio.cinematicflight.com";
const isStudioBuild = import.meta.env.VITE_APP_MODE === "studio" || isStudioHostname;
const isDashboard = isStudioBuild || window.location.pathname.startsWith("/dashboard");
const StudioEntry = lazy(() => import("./StudioEntry.jsx").then((module) => ({ default: module.StudioEntry })));
const isLocalReview = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  && window.location.pathname === '/review-inbox';
const ReviewInbox = import.meta.env.DEV ? lazy(() => import('./ReviewInbox.jsx')) : null;
const isServerReview = import.meta.env.DEV && __LOCAL_REVIEW_SERVER__
  && window.location.hostname === '127.0.0.1' && window.location.pathname === '/server-review';
const ServerReviewInbox = import.meta.env.DEV && __LOCAL_REVIEW_SERVER__ ? lazy(() => import('./ServerReviewInbox.jsx')) : null;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isServerReview ? <Suspense fallback={<main className="studio-login" role="status">Opening server review…</main>}><ServerReviewInbox /></Suspense> : isLocalReview ? <Suspense fallback={<main className="studio-login" role="status">Opening local review inbox…</main>}><ReviewInbox /></Suspense> : isDashboard ? <Suspense fallback={<main className="studio-login"><div className="studio-auth-loading" role="status">Opening Studio…</div></main>}><StudioEntry /></Suspense> : <App />}
  </React.StrictMode>,
);
