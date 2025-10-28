// src/components/analytics/SizeEffectCard.jsx
import React, { useMemo } from "react";
import styles from "./SizeEffectCard.module.css";

function binByContracts(trades){
  const m = new Map(); // key -> {n, sumR, sumDD}
  for(const t of trades){
    const k = String(t.contracts ?? t.size ?? 0);
    const r = Number(t.netR||0);
    const dd = Number(t.drawdownCash ?? 0);
    if(!m.has(k)) m.set(k,{ n:0, sumR:0, sumDD:0 });
    const x = m.get(k);
    x.n++; x.sumR += r; x.sumDD += dd;
  }
  return [...m.entries()].map(([k,v])=>({ contracts:k, n:v.n, expR: v.sumR/(v.n||1), avgDD: v.sumDD/(v.n||1) }))
           .sort((a,b)=>Number(a.contracts)-Number(b.contracts));
}

export default function SizeEffectCard({ trades }) {
  const rows = useMemo(()=>binByContracts(trades),[trades]);
  return (
    <section className={styles.card}>
      <h3>Position Size → Result</h3>
      <table className={styles.table}>
        <thead><tr><th>Контрактов</th><th>N</th><th>Expectancy (R)</th><th>Avg DD ($)</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.contracts}>
              <td>{r.contracts}</td>
              <td>{r.n}</td>
              <td className={r.expR>=0?styles.pos:styles.neg}>{r.expR.toFixed(2)}</td>
              <td className={styles.warn}>${r.avgDD.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
