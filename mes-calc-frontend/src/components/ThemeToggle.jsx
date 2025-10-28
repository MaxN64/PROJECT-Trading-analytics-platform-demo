import React, { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark" ||
          (localStorage.getItem("theme") == null &&
           window.matchMedia?.("(prefers-color-scheme: dark)").matches)
  );

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return (
    <button className={styles.btn} onClick={() => setDark(v => !v)} aria-label="Toggle theme">
      {dark ? "🌙" : "☀️"}
      <span className={styles.txt}>{dark ? "Тёмная" : "Светлая"}</span>
    </button> 
  );
}
