// src/components/analytics/ExpectancyCard.jsx
import React, { useMemo } from "react";
import styles from "./ExpectancyCard.module.css";

function stats(trades){
  const R = trades.map(t => Number(t.netR ?? 0)).filter(n=>Number.isFinite(n));
  const wins = R.filter(r=>r>0), losses = R.filter(r=>r<0);
  const sum = a => a.reduce((s,x)=>s+x,0);
  const avg = a => a.length ? sum(a)/a.length : 0;

  const wr = R.length ? wins.length / R.length : 0;
  const avgW = avg(wins);
  const avgL = avg(losses);
  const payoff = avgW && avgL ? Math.abs(avgW/avgL) : 0;
  const E = wr*avgW + (1-wr)*avgL;

  const stdev = (() => {
    if (!R.length) return 0;
    const m = avg(R);
    const v = R.reduce((s,x)=>s+(x-m)*(x-m),0)/R.length;
    return Math.sqrt(v);
  })();

  const kellyRaw = payoff ? wr - (1-wr)/payoff : 0;
  const kelly = Math.max(0, Math.min(0.3, kellyRaw)); // clamp 0..30%

  const gross = trades.reduce((s,t)=>s + Number(t.pnl||0) + Number(t.fee||0), 0);
  const net = trades.reduce((s,t)=>s + Number(t.pnl||0), 0);
  const fee = trades.reduce((s,t)=>s + Number(t.fee||0), 0);
  const feePct = gross ? fee / gross : 0;

  return { wr, avgW, avgL, payoff, E, stdev, kelly, feePct, net };
}

export default function ExpectancyCard({ trades }) {
  const s = useMemo(()=>stats(trades),[trades]);
  const pct = x => (x*100).toFixed(1)+"%";

  return (
    <section className={styles.card}>
      <header className={styles.head}><h3>Expectancy / Edge</h3></header>
      <div className={styles.grid}>
        <div className={styles.kv}><span>Win rate</span><b>{pct(s.wr)}</b></div>
        <div className={styles.kv}><span>Avg Win (R)</span><b>{s.avgW.toFixed(2)}</b></div>
        <div className={styles.kv}><span>Avg Loss (R)</span><b>{s.avgL.toFixed(2)}</b></div>
        <div className={styles.kv}><span>Payoff</span><b>{s.payoff.toFixed(2)}</b></div>
        <div className={styles.kv}><span>Expectancy / trade (R)</span><b className={s.E>=0?styles.pos:styles.neg}>{s.E.toFixed(2)}</b></div>
        <div className={styles.kv}><span>σ(R)</span><b>{s.stdev.toFixed(2)}</b></div>
        <div className={styles.kv}><span>Kelly (cap)</span><b>{pct(s.kelly)}</b></div>
        <div className={styles.kv}><span>Fee / Gross</span><b>{pct(s.feePct)}</b></div>
      </div>
      <div className={styles.note}>Kelly — справочно. Не рекомендация к рисковому манagement’у.</div>
    </section>
  );
}
