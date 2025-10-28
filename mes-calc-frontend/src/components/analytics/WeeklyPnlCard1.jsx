// src/components/analytics/WeeklyPnlCard.jsx
import React, { useMemo, useState } from "react";
import styles from "./WeeklyPnlCard.module.css";

/* ---------- helpers ---------- */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function parseDateAny(trade) {
  const raw = trade?.createdAt ?? trade?.time ?? trade?.timestamp ?? trade?.date ?? null;
  const d = raw != null ? new Date(raw) : null;
  return d && !isNaN(+d) ? d : null;
}
function pickMoney(trade) {
  const pnlLike = trade?.pnl ?? trade?.net ?? trade?.pl ?? null;
  const feeLike = trade?.fee ?? trade?.commission ?? null;
  const pnl = num(pnlLike);
  const fee = num(feeLike);             // у тебя часто отрицательная комиссия (-$0.90)
  const gross = Number.isFinite(fee) ? pnl - fee : pnl; // без комиссии
  const net = gross + fee;                                  // после комиссии
  return { gross, fee, net };
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=Пн .. 6=Вс
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
const DOW = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

function fmtMoney(v) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v || 0);
}
function fmtDateShort(d) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}
function fmtTime(d) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(d);
}
function moneyClass(v) {
  return v >= 0 ? styles.positive : styles.negative;
}
/* -------------------------------- */

export default function WeeklyPnlCard({ trades = [] }) {
  const [mode, setMode] = useState("week"); // "week" | "range"
  const [weekOffset, setWeekOffset] = useState(-2);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [chartMode, setChartMode] = useState("net"); // "net" | "gross"

  // какие дни раскрыты (по ключу yyyy-mm-dd)
  const [openDays, setOpenDays] = useState(() => new Set());

  const { from, to, title } = useMemo(() => {
    if (mode === "range" && rangeFrom && rangeTo) {
      const f = new Date(rangeFrom);
      const t = new Date(rangeTo);
      t.setHours(23, 59, 59, 999);
      return { from: f, to: t, title: `Диапазон ${fmtDateShort(f)}–${fmtDateShort(t)}` };
    }
    const today = new Date();
    const begin = startOfWeek(addDays(today, weekOffset * 7));
    const end = addDays(begin, 6);
    end.setHours(23, 59, 59, 999);
    return { from: begin, to: end, title: `Неделя ${fmtDateShort(begin)}–${fmtDateShort(addDays(begin, 4))}` };
  }, [mode, rangeFrom, rangeTo, weekOffset]);

  // нормализуем сделки и фильтруем по диапазону
  const inRange = useMemo(() => {
    return trades
      .map((t) => {
        const dt = parseDateAny(t);
        if (!dt) return null;
        const { gross, fee, net } = pickMoney(t);
        const contracts = t.contracts ?? t.size ?? null;
        const r = num(t.netR ?? t.r ?? t.R);
        return { ...t, _dt: dt, _gross: gross, _fee: fee, _net: net, _contracts: contracts, _r: r };
      })
      .filter((t) => t && t._dt >= from && t._dt <= to)
      .sort((a, b) => +a._dt - +b._dt);
  }, [trades, from, to]);

  // группируем по дням
  const days = useMemo(() => {
    const map = new Map(); // key = yyyy-mm-dd -> bucket
    for (const t of inRange) {
      const d = new Date(t._dt); d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, { date: d, count: 0, gross: 0, net: 0, fee: 0, items: [] });
      const b = map.get(key);
      b.count += 1;
      b.gross += t._gross;
      b.net += t._net;
      b.fee += t._fee;
      b.items.push(t);
    }
    if (mode === "week") {
      const arr = [];
      for (let i = 0; i < 5; i++) { // показываем Пн–Пт
        const d = addDays(from, i);
        const key = d.toISOString().slice(0, 10);
        const b = map.get(key) || { date: d, count: 0, gross: 0, net: 0, fee: 0, items: [] };
        arr.push({ ...b, key });
      }
      return arr;
    }
    return Array.from(map.entries())
      .map(([key, b]) => ({ ...b, key }))
      .sort((a, b) => +a.date - +b.date);
  }, [inRange, mode, from]);

  const totals = useMemo(
    () => days.reduce((a, d) => ({ count: a.count + d.count, gross: a.gross + d.gross, fee: a.fee + d.fee, net: a.net + d.net }), { count: 0, gross: 0, fee: 0, net: 0 }),
    [days]
  );

  const maxAbs = useMemo(() => Math.max(1, ...days.map((d) => Math.abs(chartMode === "net" ? d.net : d.gross))), [days, chartMode]);

  const expandAll = () => setOpenDays(new Set(days.map((d) => d.key)));
  const collapseAll = () => setOpenDays(new Set());

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h3>Weekly P&amp;L</h3>

        <div className={styles.controls}>
          <div className={styles.segment}>
            <button className={mode === "week" ? styles.segOn : ""} onClick={() => setMode("week")}>Неделя</button>
            <button className={mode === "range" ? styles.segOn : ""} onClick={() => setMode("range")}>Диапазон</button>
          </div>

          {mode === "week" && (
            <div className={styles.segment}>
              <button onClick={() => setWeekOffset((w) => w - 1)}>← прошлая</button>
              <button className={styles.segOn}>текущая</button>
              <button onClick={() => setWeekOffset((w) => w + 1)}>следующая →</button>
            </div>
          )}

          {mode === "range" && (
            <div className={styles.range}>
              <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              <span>—</span>
              <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
            </div>
          )}

          <div className={styles.segment}>
            <button className={chartMode === "net" ? styles.segOn : ""} onClick={() => setChartMode("net")} title="Net (после комиссий)">Net</button>
            <button className={chartMode === "gross" ? styles.segOn : ""} onClick={() => setChartMode("gross")} title="Gross (до комиссий)">Gross</button>
          </div>

          <div className={styles.segment}>
            <button onClick={expandAll}>раскрыть все</button>
            <button onClick={collapseAll}>свернуть все</button>
          </div>
        </div>
      </header>

      <div className={styles.subhead}>
        <div className={styles.rangeTitle}>{title}</div>
        <div className={styles.kpis}>
          <span>Сделок: <b>{totals.count}</b></span>
          <span>Gross: <b className={moneyClass(totals.gross)}>{fmtMoney(totals.gross)}</b></span>
          <span>Комиссия: <b>{fmtMoney(totals.fee)}</b></span>
          <span>Net: <b className={moneyClass(totals.net)}>{fmtMoney(totals.net)}</b></span>
        </div>
      </div>

      {/* заголовок таблицы дней */}
      <div className={styles.table}>
        <div className={`${styles.row} ${styles.head}`}>
          <div>День</div>
          <div>Сделок</div>
          <div>Gross</div>
          <div>Fee</div>
          <div>Net</div>
          <div>График</div>
        </div>

        {days.map((d) => {
          const opened = openDays.has(d.key);
          const toggle = () =>
            setOpenDays((prev) => {
              const next = new Set(prev);
              if (next.has(d.key)) next.delete(d.key);
              else next.add(d.key);
              return next;
            });

          return (
            <React.Fragment key={d.key}>
              {/* строка дня */}
              <div className={styles.row}>
                <div className={styles.day} onClick={toggle} role="button" tabIndex={0}>
                  <span className={`${styles.caret} ${opened ? styles.caretOpen : ""}`}>▸</span>
                  <span className={styles.dayName}>{DOW[(d.date.getDay() + 6) % 7]}</span>
                  <span className={styles.dayDate}>{fmtDateShort(d.date)}</span>
                </div>
                <div>{d.count}</div>
                <div className={moneyClass(d.gross)}>{fmtMoney(d.gross)}</div>
                <div>{fmtMoney(d.fee)}</div>
                <div className={moneyClass(d.net)}>{fmtMoney(d.net)}</div>
                <div className={styles.barCell}>
                  <Bar value={chartMode === "net" ? d.net : d.gross} maxAbs={maxAbs} />
                </div>
              </div>

              {/* детали по сделкам этого дня */}
              {opened && (
                <div className={styles.details}>
                  <div className={`${styles.tRow} ${styles.tHead}`}>
                    <div>Время</div>
                    <div>Side</div>
                    <div>Инстр.</div>
                    <div>Контр.</div>
                    <div>Gross</div>
                    <div>Fee</div>
                    <div>Net</div>
                    <div>R</div>
                  </div>

                  {d.items
                    .slice() // на всякий: сортируем по времени
                    .sort((a, b) => +a._dt - +b._dt)
                    .map((t) => (
                      <div className={styles.tRow} key={(t.id || t._id || "") + "_" + +t._dt}>
                        <div>{fmtTime(t._dt)}</div>
                        <div className={t.side === "BUY" ? styles.buy : styles.sell}>{t.side || "—"}</div>
                        <div>{t.instrument || "—"}</div>
                        <div>{t._contracts ?? "—"}</div>
                        <div className={moneyClass(t._gross)}>{fmtMoney(t._gross)}</div>
                        <div>{fmtMoney(t._fee)}</div>
                        <div className={moneyClass(t._net)}>{fmtMoney(t._net)}</div>
                        <div className={t._r >= 0 ? styles.positive : styles.negative}>{Number.isFinite(t._r) ? (Math.round(t._r * 100) / 100) : "—"}</div>
                      </div>
                    ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <footer className={styles.note}>
        Итоги «Gross» считаются как сумма P&amp;L без учёта комиссий. «Net» — после комиссий.
        По умолчанию показана текущая неделя (пн–пт). Клик по строке дня раскрывает сделки.
      </footer>
    </section>
  );
}

function Bar({ value, maxAbs }) {
  const w = Math.max(2, Math.round((Math.abs(value) / maxAbs) * 100));
  return (
    <div className={`${styles.bar} ${value >= 0 ? styles.pos : styles.neg}`} style={{ width: `${w}%` }} title={fmtMoney(value)} />
  );
}
