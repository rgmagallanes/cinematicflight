import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { SalesDashboard } from "./SalesDashboard.jsx";
import "./styles.css";
import "./dashboard.css";

const isStudioBuild = import.meta.env.VITE_APP_MODE === "studio";
const isDashboard = isStudioBuild || window.location.pathname.startsWith("/dashboard");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isDashboard ? <SalesDashboard /> : <App />}
  </React.StrictMode>,
);
