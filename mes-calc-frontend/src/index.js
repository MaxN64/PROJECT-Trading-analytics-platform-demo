import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import TradesFullPage from "./components/TradesFullPage";
import AiAssistant from "./pages/AiPlanPage";

// ---- ИНИЦИАЛИЗАЦИЯ ТЕМЫ ДО РЕНДЕРА ----
(function bootstrapTheme() {
  try {
    const saved = localStorage.getItem("theme"); // "dark" | "light" | null
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;

    const theme =
      saved === "dark" || saved === "light"
        ? saved
        : prefersDark
        ? "dark"
        : "light";

    document.documentElement.setAttribute("data-theme", theme);

    // синхронизация между вкладками
    window.addEventListener("storage", (e) => {
      if (e.key === "theme") {
        const next = e.newValue === "dark" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
      }
    });
  } catch {}
})();


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/trades" element={<TradesFullPage />} />
        <Route path="/ai" element={<AiAssistant />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
