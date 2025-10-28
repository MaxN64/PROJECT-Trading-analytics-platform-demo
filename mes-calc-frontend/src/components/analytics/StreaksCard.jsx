// src/components/analytics/StreaksCard.jsx
import React, { useMemo } from "react";
import styles from "./StreaksCard.module.css";

function calc(trades){
  const srt = [...trades].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  let cur=0, maxW=0, maxL=0;
  for(const t of srt){
    const win = Number(t.netR ?? 0) > 0 || !!t.isProfit;
    cur = win ? (cur>=0?cur+1:1) : (cur<=0?cur-1:-1);
    maxW = Math.max(maxW, cur>0?cur:0);
    maxL = Math.min(maxL, cur<0?cur:0);
  }
  return { current: cur, maxW, maxL };
}

export default function StreaksCard({ trades }) {
  const s = useMemo(()=>calc(trades),[trades]);
  return (
    <section className={styles.card}>
      <h3>Серии</h3>
      <div className={styles.grid}>
        <div className={styles.kv}><span>Текущая</span><b className={s.current>=0?styles.pos:styles.neg}>{s.current}</b></div>
        <div className={styles.kv}><span>Макс побед</span><b className={styles.pos}>{s.maxW}</b></div>
        <div className={styles.kv}><span>Макс поражений</span><b className={styles.neg}>{Math.abs(s.maxL)}</b></div>
      </div>
      <div className={styles.hint}>Используй для ограничения последовательных убыточных входов.</div>
    </section>
  );
}
