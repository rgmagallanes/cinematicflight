import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import "./dashboard.css";

const isStudioHostname = window.location.hostname.toLowerCase() === "studio.cinematicflight.com";
const isStudioBuild = import.meta.env.VITE_APP_MODE === "studio" || isStudioHostname;
const isDashboard = isStudioBuild || window.location.pathname.startsWith("/dashboard");
const StudioEntry = lazy(() => import("./StudioEntry.jsx").then((module) => ({ default: module.StudioEntry })));

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isDashboard ? <Suspense fallback={<main className="studio-login"><div className="studio-auth-loading" role="status">Opening Studio…</div></main>}><StudioEntry /></Suspense> : <App />}
  </React.StrictMode>,
);
