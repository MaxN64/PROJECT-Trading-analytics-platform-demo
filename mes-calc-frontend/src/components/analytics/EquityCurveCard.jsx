import React, { useMemo } from "react";
import styles from "./EquityCurveCard.module.css";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";

function toEquity(trades, metric = "netR") {
  const m = metric === "pnl" ? (t)=>Number(t.pnl||0) : (t)=>Number(t.netR||0);
  const sorted = [...trades].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  let acc = 0, peak = 0;
  return sorted.map((t,i)=>{
    acc += m(t);
    peak = Math.max(peak, acc);
    return {
      i,
      date: new Date(t.createdAt).toLocaleDateString("ru-RU", {day:"2-digit", month:"2-digit"}),
      equity: +acc.toFixed(2),
      dd: +(acc - peak).toFixed(2)
    };
  });
}
function ddStats(rows){
  const minDD = Math.min(0, ...rows.map(r=>r.dd));
  const maxDDAbs = Math.abs(minDD);
  const finish = rows.at(-1)?.equity ?? 0;
  const peak = rows.reduce((p,r)=>Math.max(p,r.equity),0);
  return { maxDDAbs, finish, peak };
}

export default function EquityCurveCard({ trades, unit="R" }) {
  const rows = useMemo(()=>toEquity(trades, unit==="USD"?"pnl":"netR"),[trades, unit]);
  const { maxDDAbs, finish } = useMemo(()=>ddStats(rows),[rows]);

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h3>Equity & Underwater ({unit})</h3>
        <div className={styles.kpis}>
          <span>Итог: <b>{finish.toFixed(2)} {unit}</b></span>
          <span>Max DD: <b className={styles.dd}>{-maxDDAbs.toFixed(2)} {unit}</b></span>
        </div>
      </header>

      <div className={styles.chartRow}>
        <div className={styles.chartBox}>
          <div className={styles.caption}>Equity</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={rows} margin={{ left: 6, right: 6, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.15}/>
              <XAxis dataKey="date" tick={{fontSize:11}} interval="preserveStartEnd"/>
              <YAxis tick={{fontSize:11}} width={40}/>
              <Tooltip />
              <Line type="monotone" dataKey="equity" stroke="#60a5fa" dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartBox}>
          <div className={styles.caption}>Underwater</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={rows} margin={{ left: 6, right: 6, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.15}/>
              <XAxis dataKey="date" tick={{fontSize:11}} interval="preserveStartEnd"/>
              <YAxis tick={{fontSize:11}} width={40}/>
              <Tooltip />
              <Area type="monotone" dataKey="dd" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
