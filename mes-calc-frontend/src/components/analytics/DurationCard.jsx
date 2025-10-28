// src/components/analytics/DurationCard.jsx
import React, { useMemo } from "react";
import styles from "./DurationCard.module.css";

function toMinutes(t){ return (new Date(t.closeDate||t.createdAt) - new Date(t.openDate||t.createdAt))/60000; }
function bin(trades){
  const m = new Map(); // "0-15","15-30",...
  for(const t of trades){
    const d = Math.max(0, Math.round(toMinutes(t)));
    const bin = `${Math.floor(d/15)*15}-${Math.floor(d/15)*15+15}`;
    const r = Number(t.netR||0);
    if(!m.has(bin)) m.set(bin, { n:0, sumR:0 });
    const x = m.get(bin); x.n++; x.sumR += r;
  }
  return [...m.entries()].map(([k,v])=>({ bin:k, n:v.n, exp: v.sumR/(v.n||1) }))
           .sort((a,b)=>parseInt(a.bin)-parseInt(b.bin));
}

export default function DurationCard({ trades }) {
  const rows = useMemo(()=>bin(trades),[trades]);
  return (
    <section className={styles.card}>
      <h3>Длительность сделки</h3>
      <table className={styles.table}>
        <thead><tr><th>Минуты</th><th>N</th><th>Exp (R)</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.bin}>
              <td>{r.bin}</td>
              <td>{r.n}</td>
              <td className={r.exp>=0?styles.pos:styles.neg}>{r.exp.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
