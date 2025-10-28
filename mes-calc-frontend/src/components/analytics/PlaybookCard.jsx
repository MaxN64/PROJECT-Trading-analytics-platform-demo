// src/components/analytics/PlaybookCard.jsx
import React, { useMemo, useState } from "react";
import styles from "./PlaybookCard.module.css";

function rankConditions(trades, minN=15){
  const map = new Map();
  for(const t of trades){
    const conds = Array.isArray(t.conditions)?t.conditions:[];
    const r = Number(t.netR||0);
    for(const c of conds){
      if(!map.has(c)) map.set(c,{n:0,sumR:0});
      const x = map.get(c); x.n++; x.sumR+=r;
    }
  }
  return [...map.entries()].map(([id,v])=>({ id, n:v.n, exp: v.sumR/(v.n||1) }))
         .filter(x=>x.n>=minN)
         .sort((a,b)=>b.exp-a.exp);
}

export default function PlaybookCard({ trades, conditionsDict={}, minN=15 }) {
  const [th, setTh] = useState(minN);
  const rows = useMemo(()=>rankConditions(trades, th),[trades, th]);
  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h3>Playbook — лучшие условия</h3>
        <label className={styles.minN}>
          Min N
          <input type="number" value={th} min={1} onChange={e=>setTh(parseInt(e.target.value||"1"))}/>
        </label>
      </header>
      <table className={styles.table}>
        <thead><tr><th>Условие</th><th>N</th><th>Exp (R)</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id}>
              <td>{conditionsDict[r.id]?.label || r.id}</td>
              <td>{r.n}</td>
              <td className={r.exp>=0?styles.pos:styles.neg}>{r.exp.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
