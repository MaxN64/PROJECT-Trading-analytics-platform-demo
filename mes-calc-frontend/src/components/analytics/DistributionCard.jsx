// src/components/analytics/DistributionCard.jsx
import React, { useMemo, useState } from "react";
import styles from "./DistributionCard.module.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

function buildHist(values, bins=20){
  if (!values.length) return [];
  const lo = Math.min(...values), hi = Math.max(...values);
  const step = (hi-lo)/bins || 1;
  const arr = new Array(bins).fill(0).map((_,i)=>({x:+(lo+i*step).toFixed(2), n:0}));
  values.forEach(v=>{
    let k = Math.floor((v-lo)/step);
    if (k>=bins) k=bins-1; if (k<0) k=0;
    arr[k].n++;
  });
  return arr;
}

export default function DistributionCard({ trades, metric="netR" }) {
  const [m,setM] = useState(metric);
  const vals = useMemo(()=>trades.map(t=>Number(m==="pnl"?t.pnl:t.netR)).filter(Number.isFinite),[trades,m]);
  const hist = useMemo(()=>buildHist(vals, 18),[vals]);
  const mean = useMemo(()=>vals.reduce((s,x)=>s+x,0)/(vals.length||1),[vals]);

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h3>Distribution ({m==="pnl"?"$PnL":"R"})</h3>
        <select className={styles.sel} value={m} onChange={e=>setM(e.target.value)}>
          <option value="netR">R</option>
          <option value="pnl">$PnL</option>
        </select>
      </header>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={hist} margin={{left:6,right:6,top:6,bottom:0}}>
          <CartesianGrid vertical={false} strokeOpacity={0.15}/>
          <XAxis dataKey="x" tick={{fontSize:11}} />
          <YAxis tick={{fontSize:11}} width={40}/>
          <Tooltip />
          <ReferenceLine x={0} stroke="#888" />
          <ReferenceLine y={0} stroke="#888" />
          <ReferenceLine x={mean} stroke="#60a5fa" />
          <Bar dataKey="n" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
