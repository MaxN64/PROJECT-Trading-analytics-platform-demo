import React from "react";
import styles from "./PerfToggles.module.css";

const LS_KEY = "perf_toggles_v1";

export const DEFAULT_TOGGLES = {
  embeds: true,   // EconCalendar + TradingView
  charts: true,   // Charts + HeatmapTime
  stats:  true,   // ConditionsStats + VisualMetrics
  heavy:  true,   // тяжёлые аналитические карточки
  playbook: true, // PlaybookCard
};

export function loadPerfToggles() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_TOGGLES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_TOGGLES, ...parsed };
  } catch {
    return DEFAULT_TOGGLES;
  }
}
export function savePerfToggles(val) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(val)); } catch {}
}

export default function PerfToggles({ value, onChange, safeMode }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <div className={styles.bar} role="region" aria-label="Производительность">
      <div className={styles.left}>
        <strong>Производительность</strong>
        {safeMode ? (
          <span className={styles.badgeDanger}>SAFE</span>
        ) : (
          <span className={styles.badgeOk}>норм</span>
        )}
      </div>

      <div className={styles.switches}>
        <Switch label="Embeds"   title="Экономический календарь и TradingView" checked={value.embeds}   onChange={(v)=>set("embeds", v)} />
        <Switch label="Charts"   title="Лёгкие графики и теплокарта"          checked={value.charts}   onChange={(v)=>set("charts", v)} />
        <Switch label="Stats"    title="Статистика условий и визуальные метрики" checked={value.stats} onChange={(v)=>set("stats", v)} />
        <Switch label="Heavy"    title="Тяжёлые аналитические карточки"       checked={value.heavy}    onChange={(v)=>set("heavy", v)} />
        <Switch label="Playbook" title="Матрица сетапов (Playbook)"           checked={value.playbook} onChange={(v)=>set("playbook", v)} />
      </div>

      <div className={styles.hint}>
        Быстро лагодит? Откройте страницу с <code>?safe=1</code> — всё тяжёлое выключится.
      </div>
    </div>
  );
}

function Switch({ label, checked, onChange, title }) {
  return (
    <label className={styles.switch} title={title}>
      <input type="checkbox" checked={!!checked} onChange={(e)=>onChange(e.target.checked)} />
      <span className={styles.box} aria-hidden />
      <span>{label}</span>
    </label>
  );
}
