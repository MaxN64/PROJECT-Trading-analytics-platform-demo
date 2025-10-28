import React, { useEffect, useMemo, useState } from "react";
import styles from "./ConditionsStats.module.css";

/**
 * props:
 *  - trades: массив сделок (лучше уже отфильтрованный)
 *  - conditions: [{ id, label }]
 *  - minTradesDefault?: число — минимальное кол-во сделок для показа строки
 */
export default function ConditionsStats({ trades, conditions, minTradesDefault = 3 }) {
  // RR берём из LS, чтобы совпадало с Analytics/Charts
  const [rr, setRR] = useState(() => {
    const v = localStorage.getItem("mes-calc-rr");
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "mes-calc-rr") {
        const n = Number(e.newValue);
        if (Number.isFinite(n) && n > 0) setRR(n);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const [minTrades, setMinTrades] = useState(minTradesDefault);
  const [sort, setSort] = useState({ key: "winrate", dir: "desc" }); // asc|desc

  const rows = useMemo(() => {
    // агрегируем по каждому условию
    const result = conditions.map(({ id, label }) => {
      let total = 0, wins = 0, losses = 0;
      let sumWin = 0, sumLoss = 0, pnl = 0;

      for (const t of trades || []) {
        if (!Array.isArray(t.conditions) || !t.conditions.includes(id)) continue;
        total += 1;

        const perRisk = Number(t.perContractRisk ?? (t.stopPoints * (t.pricePerPoint || 1.25)));
        const contracts = Number(t.contracts || 0);
        const winVal = rr * perRisk * contracts;
        const lossVal = perRisk * contracts;

        if (t.isProfit) {
          wins += 1;
          sumWin += winVal;
          pnl += winVal;
        } else {
          losses += 1;
          sumLoss += lossVal;
          pnl -= lossVal;
        }
      }

      const winrate = total ? (wins / total) * 100 : 0;
      const avgWin = wins ? sumWin / wins : 0;
      const avgLoss = losses ? sumLoss / losses : 0;
      const p = total ? wins / total : 0;
      const expectancy = p * avgWin - (1 - p) * avgLoss;

      return {
        id, label, total, wins, losses,
        winrate: +winrate.toFixed(1),
        avgWin, avgLoss, expectancy, pnl,
      };
    });

    // фильтр по минимуму сделок
    let filtered = result.filter(r => r.total >= (minTrades || 0));

    // сортировка
    const dir = sort.dir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const ka = a[sort.key];
      const kb = b[sort.key];
      if (ka < kb) return -1 * dir;
      if (ka > kb) return 1 * dir;
      return 0;
    });

    return filtered;
  }, [trades, conditions, rr, minTrades, sort]);

  const fmtMoney = (n) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
  const fmtPct = (n) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n) + " %";

  const setSortKey = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  // экспорт CSV
  const exportCSV = () => {
    const header = ["Условие","Сделок","Win rate","Средн. прибыль","Средн. убыток","Ожидаемость","PnL"];
    const data = rows.map(r => [
      r.label,
      r.total,
      `${r.winrate}%`,
      r.avgWin.toFixed(2),
      r.avgLoss.toFixed(2),
      r.expectancy.toFixed(2),
      r.pnl.toFixed(2),
    ]);
    const csv = [header, ...data]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conditions_stats_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3>Статистика по условиям</h3>
        <div className={styles.controls}>
          <label className={styles.inline}>
            Минимум сделок:
            <input
              className={styles.input}
              type="number" min="0" step="1"
              value={minTrades}
              onChange={(e)=>setMinTrades(Number(e.target.value))}
            />
          </label>
          <button className={styles.btn} onClick={exportCSV}>Экспорт CSV</button>
        </div>
      </div>

      <div className={styles.table} role="table" aria-label="Статистика условий">
        <div className={`${styles.tr} ${styles.th}`} role="row">
          <div className={styles.td}>Условие</div>
          <button className={styles.tdBtn} onClick={()=>setSortKey("total")}>Сделок {arrow(sort,"total")}</button>
          <button className={styles.tdBtn} onClick={()=>setSortKey("winrate")}>Win rate {arrow(sort,"winrate")}</button>
          <button className={styles.tdBtn} onClick={()=>setSortKey("avgWin")}>Средн. прибыль {arrow(sort,"avgWin")}</button>
          <button className={styles.tdBtn} onClick={()=>setSortKey("avgLoss")}>Средн. убыток {arrow(sort,"avgLoss")}</button>
          <button className={styles.tdBtn} onClick={()=>setSortKey("expectancy")}>Ожидаемость {arrow(sort,"expectancy")}</button>
          <button className={styles.tdBtn} onClick={()=>setSortKey("pnl")}>PnL {arrow(sort,"pnl")}</button>
        </div>

        {rows.length === 0 ? (
          <div className={styles.empty}>Нет строк для отображения — увеличьте период/снимите фильтры или уменьшите порог «минимум сделок».</div>
        ) : rows.map(r => (
          <div key={r.id} className={styles.tr} role="row">
            <div className={`${styles.td} ${styles.cond}`}>{r.label}</div>
            <div className={styles.td}>{r.total}</div>
            <div className={styles.td}>{fmtPct(r.winrate)}</div>
            <div className={styles.td}>{fmtMoney(r.avgWin)}</div>
            <div className={styles.td}>{fmtMoney(r.avgLoss)}</div>
            <div className={styles.td}>{fmtMoney(r.expectancy)}</div>
            <div className={styles.td}>{fmtMoney(r.pnl)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function arrow(sort, key) {
  if (sort.key !== key) return "";
  return sort.dir === "asc" ? "▲" : "▼";
}
