import React, { useMemo } from "react";
import styles from "./HourHeatmap.module.css";

/** Ожидает trades с полями localHour (0..23) и netR (число). */
export default function HourHeatmap({ trades = [] }) {
  const data = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => []);
    for (const t of trades) {
      const h = Number(t.localHour);
      if (Number.isInteger(h) && h >= 0 && h < 24 && Number.isFinite(t.netR)) {
        buckets[h].push(Number(t.netR));
      }
    }
    const avg = buckets.map(arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0);
    const min = Math.min(...avg), max = Math.max(...avg);
    return { avg, min, max };
  }, [trades]);

  const color = (v) => {
    if (!Number.isFinite(v)) return "transparent";
    if (v === 0) return "rgba(255,255,255,.08)";
    if (v > 0) {
      const k = Math.min(1, v / (data.max || 1));
      return `rgba(16,185,129,${0.25 + 0.55*k})`;
    } else {
      const k = Math.min(1, Math.abs(v) / (Math.abs(data.min) || 1));
      return `rgba(239,68,68,${0.25 + 0.55*k})`;
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>Heatmap по часам (avg R)</div>
      <div className={styles.grid}>
        {data.avg.map((v, h) => (
          <div key={h} className={styles.cell} style={{ background: color(v) }}>
            <div className={styles.h}>{String(h).padStart(2,"0")}:00</div>
            <div className={styles.v}>{v.toFixed(2)}R</div>
          </div>
        ))}
      </div>
    </div>
  );
}
