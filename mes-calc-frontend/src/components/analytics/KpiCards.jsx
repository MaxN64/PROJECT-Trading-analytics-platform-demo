import React, { useMemo } from "react";
import styles from "./KpiCards.module.css";

function kpiFromTrades(trades = []) {
  const rs = trades.map(t => Number(t.netR)).filter(Number.isFinite);
  const n = rs.length;
  if (!n) return { n:0, winP:0, avgWinR:0, avgLossR:0, expectancy:0, payoff:0 };
  const wins = rs.filter(r => r > 0);
  const losses = rs.filter(r => r < 0);
  const winP = wins.length / n;
  const avgWinR = wins.length ? wins.reduce((a,b)=>a+b,0) / wins.length : 0;
  const avgLossR = losses.length ? losses.reduce((a,b)=>a+b,0) / losses.length : 0;
  const expectancy = rs.reduce((a,b)=>a+b,0) / n;
  const payoff = avgLossR ? (avgWinR / Math.abs(avgLossR)) : 0;
  return { n, winP, avgWinR, avgLossR, expectancy, payoff };
}

export default function KpiCards({ trades = [] }) {
  const k = useMemo(() => kpiFromTrades(trades), [trades]);
  return (
    <div className={styles.grid}>
      <Card label="Сделок" value={k.n} />
      <Card label="Win %" value={(k.winP*100).toFixed(1) + "%"} />
      <Card label="Avg Win (R)" value={k.avgWinR.toFixed(2)} />
      <Card label="Avg Loss (R)" value={k.avgLossR.toFixed(2)} />
      <Card label="Expectancy (R)" value={k.expectancy.toFixed(2)} />
      <Card label="Payoff" value={k.payoff.toFixed(2)} />
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <div className={styles.value}>{String(value)}</div>
    </div>
  );
}
