import React, { useEffect, useState } from "react";
import styles from "./Filters.module.css";

// Удобные типы
const OUTCOME = { all: "all", win: "win", loss: "loss" };
const SIDE = { all: "all", buy: "BUY", sell: "SELL" };

function getLocalMinusNYHours() {
  const now = new Date();
  const nyHourNow = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/New_York",
    }).format(now)
  );
  const localHourNow = now.getHours();
  let delta = localHourNow - nyHourNow;
  if (delta > 23) delta -= 24;
  if (delta < -23) delta += 24;
  return delta;
}
function nyHourToLocal(nyHour) {
  const delta = getLocalMinusNYHours();
  return ((nyHour + delta) % 24 + 24) % 24;
}

export default function Filters({ allConditions, onChange, totalCount }) {
  // состояния фильтра
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hourFrom, setHourFrom] = useState("");
  const [hourTo, setHourTo] = useState("");
  const [outcome, setOutcome] = useState(OUTCOME.all);
  const [selectedConds, setSelectedConds] = useState([]);
  const [matchModeAll, setMatchModeAll] = useState(false); // false = любые, true = все

  // НОВОЕ: фильтр по направлению сделки и инструменту
  const [side, setSide] = useState(SIDE.all);
  const [instrument, setInstrument] = useState("");

  // НОВОЕ: сортировка
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  // НОВОЕ: сворачивание панели
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("filters_collapsed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("filters_collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  // эмитим наружу объект фильтра
  useEffect(() => {
    onChange?.({
      dateFrom,
      dateTo,
      hourFrom: hourFrom === "" ? null : Number(hourFrom),
      hourTo: hourTo === "" ? null : Number(hourTo),
      outcome,
      conditions: selectedConds,
      matchAll: matchModeAll,

      side,
      instrument: instrument.trim().toUpperCase(),
      sortBy,
      sortDir,
    });
  }, [
    dateFrom,
    dateTo,
    hourFrom,
    hourTo,
    outcome,
    selectedConds,
    matchModeAll,
    side,
    instrument,
    sortBy,
    sortDir,
    onChange,
  ]);

  const hasActive =
    dateFrom ||
    dateTo ||
    hourFrom !== "" ||
    hourTo !== "" ||
    outcome !== OUTCOME.all ||
    selectedConds.length > 0 ||
    side !== SIDE.all ||
    instrument.trim() !== "";

  // Быстрые пресеты (часы Нью-Йорка -> локальные)
  const applyPreset = (type) => {
    if (type === "open") {
      const a = nyHourToLocal(9);
      const b = nyHourToLocal(10);
      setHourFrom(String(a));
      setHourTo(String(b));
    } else if (type === "rth") {
      const a = nyHourToLocal(9);
      const b = nyHourToLocal(16);
      setHourFrom(String(a));
      setHourTo(String(b));
    } else if (type === "lunch") {
      const a = nyHourToLocal(12);
      const b = nyHourToLocal(14);
      setHourFrom(String(a));
      setHourTo(String(b));
    }
  };

  return (
    <section className={`${styles.bar} ${collapsed ? styles.collapsed : ""}`}>
      {/* Кнопка сворачивания */}
      <button
        type="button"
        className={styles.collapseBtn}
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        title={collapsed ? "Развернуть фильтры" : "Свернуть фильтры"}
      >
        {collapsed ? "Развернуть ▾" : "Свернуть ▴"}
      </button>

      <div className={styles.left}>
        <strong className={styles.title}>Фильтры</strong>
        {hasActive ? (
          <span className={styles.badgeActive}>включены</span>
        ) : (
          <span className={styles.badge}>выкл</span>
        )}
        {!!totalCount && (
          <span className={styles.meta}>по {totalCount} сделкам</span>
        )}
      </div>

      {/* Быстрые пресеты */}
      <div className={styles.presets}>
        <span className={styles.pLabel}>Быстрые пресеты:</span>
        <button className={styles.pBtn} onClick={() => applyPreset("open")}>
          Открытие (NY 9:30–10:00)
        </button>
        <button className={styles.pBtn} onClick={() => applyPreset("rth")}>
          RTH (NY 9:30–16:00)
        </button>
        <button className={styles.pBtn} onClick={() => applyPreset("lunch")}>
          Обед (NY 12:00–13:30)
        </button>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>От даты</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>До даты</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Час с</span>
          <input
            type="number"
            min="0"
            max="23"
            placeholder="0–23"
            value={hourFrom}
            onChange={(e) => setHourFrom(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Час по</span>
          <input
            type="number"
            min="0"
            max="23"
            placeholder="0–23"
            value={hourTo}
            onChange={(e) => setHourTo(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Результат</span>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value={OUTCOME.all}>Все</option>
            <option value={OUTCOME.win}>Прибыль</option>
            <option value={OUTCOME.loss}>Убыток</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Side</span>
          <select value={side} onChange={(e) => setSide(e.target.value)}>
            <option value={SIDE.all}>Все</option>
            <option value={SIDE.buy}>BUY</option>
            <option value={SIDE.sell}>SELL</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Инструмент</span>
          <input
            placeholder="например ES / MES / FGBL"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            onBlur={() => setInstrument((s) => s.toUpperCase())}
          />
        </label>

        <label className={styles.field}>
          <span>Сортировка</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="createdAt">Дата</option>
            <option value="contracts">Контракты</option>
            <option value="pnl">$P&L</option>
            <option value="netR">R (net)</option>
            <option value="fee">Комиссия</option>
            <option value="pips">Pips</option>
            <option value="ddCash">DD ($)</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Направление</span>
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
            <option value="desc">По убыванию</option>
            <option value="asc">По возрастанию</option>
          </select>
        </label>

        <details className={styles.conditions}>
          <summary>Условия ({selectedConds.length})</summary>
          <div className={styles.condBody}>
            <label className={styles.matchToggle}>
              <input
                type="checkbox"
                checked={matchModeAll}
                onChange={(e) => setMatchModeAll(e.target.checked)}
              />
              <span />
              {matchModeAll ? "Совпадение: все" : "Совпадение: любые"}
            </label>
            <div className={styles.condList}>
              {allConditions.map((c) => (
                <label key={c.id} className={styles.condItem}>
                  <input
                    type="checkbox"
                    checked={selectedConds.includes(c.id)}
                    onChange={() => {
                      setSelectedConds((prev) =>
                        prev.includes(c.id)
                          ? prev.filter((x) => x !== c.id)
                          : [...prev, c.id]
                      );
                    }}
                  />
                  <span className={styles.box} aria-hidden />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        </details>

        <button
          className={styles.reset}
          onClick={() => {
            setDateFrom("");
            setDateTo("");
            setHourFrom("");
            setHourTo("");
            setOutcome(OUTCOME.all);
            setSelectedConds([]);
            setMatchModeAll(false);
            setSide(SIDE.all);
            setInstrument("");
            setSortBy("createdAt");
            setSortDir("desc");
          }}
        >
          Сбросить
        </button>
      </div>
    </section>
  );
}
