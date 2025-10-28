// src/components/analytics/FeesCard.jsx
import React, { useMemo } from "react";
import styles from "./FeesCard.module.css";

export default function FeesCard({ trades }) {
  const s = useMemo(()=>{
    const gross = trades.reduce((a,t)=>a+Number(t.pnl||0)+Number(t.fee||0),0);
    const fee = trades.reduce((a,t)=>a+Number(t.fee||0),0);
    const byTrade = trades.length ? fee/trades.length : 0;
    const byContr = (() => {
      const contrSum = trades.reduce((a,t)=>a+Number(t.contracts||t.size||0),0);
      return contrSum ? fee/contrSum : 0;
    })();
    return { gross, fee, byTrade, byContr, feePct: gross?fee/gross:0 };
  },[trades]);

  const pct = (x)=> (x*100).toFixed(1)+"%";

  return (
    <section className={styles.card}>
      <h3>Комиссии</h3>
      <div className={styles.grid}>
        <div className={styles.kv}><span>Всего комиссий</span><b>${s.fee.toFixed(2)}</b></div>
        <div className={styles.kv}><span>Fee / сделку</span><b>${s.byTrade.toFixed(2)}</b></div>
        <div className={styles.kv}><span>Fee / контракт</span><b>${s.byContr.toFixed(2)}</b></div>
        <div className={styles.kv}><span>Fee / Gross</span><b>{pct(s.feePct)}</b></div>
      </div>
    </section>
  );
}
