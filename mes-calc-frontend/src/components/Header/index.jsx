// src/components/Header/index.jsx
import React, { useState } from "react";
import styles from "./styles.module.css";

import PerfToggles from "../PerfToggles";
import TradingViewOpenButton from "../TradingViewOpenButton";

function ThemeToggle() {
  const getInitial = () =>
    document.documentElement.getAttribute("data-theme") || "dark";
  const [theme, setTheme] = useState(getInitial);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  };
  return (
    <button className={styles.themeBtn} onClick={toggle} title="Сменить тему">
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}

export default function Header({
  perfValue,
  onPerfChange,
  safeMode,
  tvLabel = "ES-chart-1m",
  tvSymbol = "CME_MINI:ES1!",
}) {
  // для HashRouter формируем ссылку как "#/ai?auto=1"
  const aiHref = "#/ai?auto=1";

  return (
    <header className={styles.sticky}>
      <div className={styles.bar}>
        <div className={styles.left}>
          <div className={styles.titleBox}>
            <h1 className={styles.title}>Trading analytics platform</h1>
            <p className={styles.subtitle}>
              Контракты по стоп-лоссу с фиксированным риском
            </p>
          </div>
        </div>

        <div className={styles.center}>
          <PerfToggles value={perfValue} onChange={onPerfChange} safeMode={safeMode} />
        </div>

        <div className={styles.right}>
          <TradingViewOpenButton label={tvLabel} symbol={tvSymbol} />

          {/* Открываем в новой вкладке */}
          <a
            href={aiHref}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.aiBtn}
            title="Открыть AI-план в новой вкладке"
          >
            🧠 ES-AI Planning
          </a>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
