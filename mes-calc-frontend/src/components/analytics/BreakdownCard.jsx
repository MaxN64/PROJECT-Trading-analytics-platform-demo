// src/components/analytics/BreakdownCard.jsx
import React, { useMemo } from "react";
import styles from "./BreakdownCard.module.css";

function groupBy(arr, keyFn){
  const m = new Map();
  for(const x of arr){
    const k = keyFn(x);
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return [...m.entries()].map(([k,v])=>({ key:k, trades:v }));
}
function agg(rows){
  const n = rows.length;
  const R = rows.map(t=>Number(t.netR||0));
  const wr = R.filter(r=>r>0).length/(n||1);
  const exp = R.reduce((s,x)=>s+x,0)/(n||1);
  const pnl = rows.reduce((s,t)=>s+Number(t.pnl||0),0);
  return { n, wr, exp, pnl };
}

export default function BreakdownCard({ trades }) {
  const bySide = useMemo(()=>groupBy(trades, t=>t.side||"—").map(x=>({ ...agg(x.trades), key:x.key })),[trades]);
  const byInstr = useMemo(()=>groupBy(trades, t=>t.instrument||"—").map(x=>({ ...agg(x.trades), key:x.key }))
                           .sort((a,b)=>b.n-a.n),[trades]);

  const fmtPct = x => (x*100).toFixed(1)+"%";

  return (
    <section className={styles.card}>
      <h3>Разрез: Side / Instrument</h3>
      <div className={styles.columns}>
        <table className={styles.table}>
          <thead><tr><th>Side</th><th>N</th><th>WR</th><th>Exp (R)</th><th>PnL $</th></tr></thead>
          <tbody>
            {bySide.map(r=>(
              <tr key={r.key}>
                <td>{r.key}</td><td>{r.n}</td><td>{fmtPct(r.wr)}</td>
                <td className={r.exp>=0?styles.pos:styles.neg}>{r.exp.toFixed(2)}</td>
                <td className={r.pnl>=0?styles.pos:styles.neg}>${r.pnl.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className={styles.table}>
          <thead><tr><th>Instrument</th><th>N</th><th>WR</th><th>Exp (R)</th><th>PnL $</th></tr></thead>
          <tbody>
            {byInstr.map(r=>(
              <tr key={r.key}>
                <td>{r.key}</td><td>{r.n}</td><td>{fmtPct(r.wr)}</td>
                <td className={r.exp>=0?styles.pos:styles.neg}>{r.exp.toFixed(2)}</td>
                <td className={r.pnl>=0?styles.pos:styles.neg}>${r.pnl.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
