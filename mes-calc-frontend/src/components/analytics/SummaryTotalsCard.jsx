import React, { useMemo } from "react";
import styles from "./SummaryTotalsCard.module.css";

function fmtUSD(n) {
  const x = Number(n);
  if (!isFinite(x)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(x);
}

export default function SummaryTotalsCard({ trades = [] }) {
  const stats = useMemo(() => {
    let count = 0;
    let grossProfit = 0;   // сумма всех положительных P&L
    let grossLoss = 0;     // сумма модулей отрицательных P&L
    let fees = 0;

    for (const t of trades) {
      const pnl = Number(t?.pnl ?? 0);
      const fee = Number(t?.fee ?? 0);
      if (!Number.isFinite(pnl)) continue;

      count += 1;
      if (pnl >= 0) grossProfit += pnl;
      else grossLoss += Math.abs(pnl);

      if (Number.isFinite(fee)) fees += fee;
    }

    const net = grossProfit - grossLoss - fees;

    return {
      count,
      grossProfit,
      grossLoss,
      fees,
      net,
      winRate: count ? (trades.filter(t => Number(t?.pnl ?? 0) >= 0).length / count) : 0,
    };
  }, [trades]);

  return (
    <section className={styles.card} aria-label="Сводка P&L">
      <header className={styles.header}>
        <h3 className={styles.title}>Сводка P&amp;L</h3>
        <div className={styles.sub}>по текущей выборке</div>
      </header>

      <div className={styles.grid}>
        <div className={styles.item}>
          <div className={styles.label}>Сделок</div>
          <div className={styles.value}>{stats.count}</div>
        </div>

        <div className={styles.item}>
          <div className={styles.label}>Прибыль (gross)</div>
          <div className={`${styles.value} ${styles.win}`}>
            {fmtUSD(stats.grossProfit)}
          </div>
        </div>

        <div className={styles.item}>
          <div className={styles.label}>Убыток (gross)</div>
          <div className={`${styles.value} ${styles.loss}`}>
            {fmtUSD(stats.grossLoss)}
          </div>
        </div>

        <div className={styles.item}>
          <div className={styles.label}>Комиссии</div>
          <div className={styles.value}>{fmtUSD(stats.fees)}</div>
        </div>

        <div className={styles.itemWide}>
          <div className={styles.label}>Итог (net)</div>
          <div
            className={`${styles.valueLg} ${
              stats.net >= 0 ? styles.win : styles.loss
            }`}
          >
            {fmtUSD(stats.net)}
          </div>
          <div className={styles.hint}>
            net = profit − loss − fees • win-rate:{" "}
            {(stats.winRate * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </section>
  );
}
