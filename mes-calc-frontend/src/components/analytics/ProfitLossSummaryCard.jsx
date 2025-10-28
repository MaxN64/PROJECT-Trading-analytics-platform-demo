import React, { useMemo } from "react";
import styles from "./ProfitLossSummaryCard.module.css";

function formatMoney(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Карточка "Сводка P&L"
 * props:
 *  - trades: Array<{ pnl?: number }>
 */
export default function ProfitLossSummaryCard({ trades = [] }) {
  const { profit, lossAbs, count } = useMemo(() => {
    let profit = 0;
    let loss = 0;
    let count = 0;

    for (const t of trades) {
      const pnl = Number(t?.pnl);
      if (!isFinite(pnl)) continue;
      count++;
      if (pnl > 0) profit += pnl;
      else if (pnl < 0) loss += pnl; // loss is negative
    }
    return { profit, lossAbs: Math.abs(loss), count };
  }, [trades]);

  return (
    <section className={styles.card} aria-label="Сводка P&L">
      <header className={styles.head}>
        <h3 className={styles.title}>Сводка P&amp;L</h3>
        <span className={styles.totalCount} title="Всего сделок">
          {count}
        </span>
      </header>

      <div className={styles.grid}>
        <div className={styles.item}>
          <div className={styles.label}>Прибыль (сумма)</div>
          <div className={`${styles.value} ${styles.profit}`}>{formatMoney(profit)}</div>
        </div>

        <div className={styles.item}>
          <div className={styles.label}>Убыток (сумма)</div>
          <div className={`${styles.value} ${styles.loss}`}>{formatMoney(lossAbs)}</div>
        </div>

        <div className={styles.item}>
          <div className={styles.label}>Сделок всего</div>
          <div className={styles.value}>{count}</div>
        </div>
      </div>
    </section>
  );
}
