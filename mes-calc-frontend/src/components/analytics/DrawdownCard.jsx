// src/components/analytics/DrawdownCard.jsx
import React, { useMemo } from "react";
import styles from "./DrawdownCard.module.css";

export default function DrawdownCard({ trades }) {
  const s = useMemo(()=>{
    const dd = trades.map(t=>Number(t.drawdownCash ?? 0)).filter(Number.isFinite);
    const pos = trades.filter(t=>(Number(t.netR||0)>0));
    const neg = trades.filter(t=>(Number(t.netR||0)<0));
    const avg = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : 0;
    return {
      avgDD: avg(dd),
      avgWinDD: avg(pos.map(t=>Number(t.drawdownCash||0))),
      avgLossDD: avg(neg.map(t=>Number(t.drawdownCash||0))),
      overRiskPct: (()=> {
        // доля сделок, где DD$ превысил плановый риск по сделке (если есть per-contract/per-trade — возьмём |netR|>1 как суррогат)
        const bad = trades.filter(t=>Number(t.netR) < -1).length;
        return trades.length ? bad / trades.length : 0;
      })()
    };
  },[trades]);

  const pct = x=>(x*100).toFixed(1)+"%";

  return (
    <section className={styles.card}>
      <h3>Drawdown (по сделке)</h3>
      <div className={styles.grid}>
        <div className={styles.kv}><span>Средний DD ($)</span><b className={styles.warn}>${s.avgDD.toFixed(2)}</b></div>
        <div className={styles.kv}><span>DD побед ($)</span><b>${s.avgWinDD.toFixed(2)}</b></div>
        <div className={styles.kv}><span>DD поражений ($)</span><b>${s.avgLossDD.toFixed(2)}</b></div>
        <div className={styles.kv}><span>Доля &lt; −1R</span><b>{pct(s.overRiskPct)}</b></div>
      </div>
    </section>
  );
}
