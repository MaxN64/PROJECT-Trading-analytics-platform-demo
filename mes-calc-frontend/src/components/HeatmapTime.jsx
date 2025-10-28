import React, { useMemo, useState } from "react";
import styles from "./HeatmapTime.module.css";

/**
 * props:
 *  - trades: отфильтрованные сделки
 *  - metric?: "winrate" | "pnl" — что показывать цветом. По умолчанию "winrate"
 */
export default function HeatmapTime({ trades, metric = "winrate" }) {
  const [mode, setMode] = useState(metric); // локальное переключение метрики

  // 7x24 матрица (дни: Пн..Вс, часы 0..23, локальное время)
  const matrix = useMemo(() => {
    const empty = () =>
      Array.from({ length: 24 }, () => ({ wins: 0, total: 0, pnl: 0 }));
    const map = Array.from({ length: 7 }, empty);

    for (const t of trades || []) {
      const d = new Date(t.createdAt);
      // day: 0-вс..6-сб -> хотим 0-пн..6-вс
      const dow = (d.getDay() + 6) % 7;
      const h = d.getHours();

      const perRisk = Number(
        t.perContractRisk ?? t.stopPoints * (t.pricePerPoint || 1.25)
      );
      const contracts = Number(t.contracts || 0);
      const rr =
        Number(localStorage.getItem("mes-calc-rr")) > 0
          ? Number(localStorage.getItem("mes-calc-rr"))
          : 1;

      const pnl = t.isProfit
        ? rr * perRisk * contracts
        : -perRisk * contracts;

      const cell = map[dow][h];
      cell.total += 1;
      if (t.isProfit) cell.wins += 1;
      cell.pnl += pnl;
    }

    // готовим значения для отрисовки
    return map.map((row) =>
      row.map((c) => ({
        winrate: c.total ? (c.wins / c.total) * 100 : 0,
        pnl: c.pnl,
        total: c.total,
      }))
    );
  }, [trades]);

  // цветовка: от красного к зелёному (для winrate) и от синего к оранжевому (для pnl)
  const toColor = (cell) => {
    if (mode === "pnl") {
      const v = Math.max(-500, Math.min(500, cell.pnl)); // клип
      const t = (v + 500) / 1000; // 0..1
      // 210° (синий) -> 25° (оранжевый)
      const hue = 210 + (25 - 210) * t;
      return `hsl(${hue}, 85%, ${cell.total ? 50 : 12}%)`;
    } else {
      const v = cell.winrate; // 0..100
      const t = v / 100;
      // 0° (красный) -> 140° (зеленоватый)
      const hue = 0 + (140 - 0) * t;
      return `hsl(${hue}, 70%, ${cell.total ? 45 : 12}%)`;
    }
  };

  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3>Heatmap: Дни × Часы</h3>
        <div className={styles.controls}>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={mode === "pnl"}
              onChange={(e) => setMode(e.target.checked ? "pnl" : "winrate")}
            />
            <span />
            {mode === "pnl" ? "PnL" : "Win rate"}
          </label>
          <span className={styles.meta}>
            По {trades?.length || 0} сделкам (локальное время)
          </span>
        </div>
      </div>

      <div className={styles.gridWrap}>
        <div className={styles.hours}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className={styles.hour}>
              {h}
            </div>
          ))}
        </div>

        <div className={styles.matrix}>
          {matrix.map((row, r) => (
            <div key={r} className={styles.row}>
              <div className={styles.dayLabel}>{days[r]}</div>
              {row.map((cell, c) => (
                <div
                  key={c}
                  className={styles.cell}
                  style={{ background: toColor(cell) }}
                  title={`${days[r]} ${c}:00 — ${mode === "pnl"
                      ? `PnL: ${cell.pnl.toFixed(2)}$`
                      : `Win rate: ${cell.winrate.toFixed(1)}%`
                    } (N=${cell.total})`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        {mode === "pnl" ? (
          <>
            <span>—</span><span>−500$</span>
            <span className={styles.gradPnl} />
            <span>+500$</span><span>—</span>
          </>
        ) : (
          <>
            <span>—</span><span>0%</span>
            <span className={styles.gradWr} />
            <span>100%</span><span>—</span>
          </>
        )}
      </div>
    </section>
  );
}
