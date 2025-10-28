import React, { useEffect, useMemo, useState } from "react";
import styles from "./Charts.module.css";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";

/**
 * props:
 *  - trades: массив (лучше передавать уже отфильтрованный)
 */
export default function Charts({ trades }) {
  // RR берём из localStorage (как в Analytics), чтобы была консистентность
  const [rr, setRR] = useState(() => {
    const v = localStorage.getItem("mes-calc-rr");
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

  useEffect(() => {
    // если RR изменят в аналитике — подхватим
    const onStorage = (e) => {
      if (e.key === "mes-calc-rr") {
        const n = Number(e.newValue);
        if (Number.isFinite(n) && n > 0) setRR(n);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ---- Equity curve
  const equityData = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) return [];
    let cum = 0;
    const rows = [...trades].sort((a, b) => a.createdAt - b.createdAt);
    return rows.map((t) => {
      const perRisk = Number(t.perContractRisk ?? (t.stopPoints * (t.pricePerPoint || 1.25)));
      const contracts = Number(t.contracts || 0);
      const pnl = t.isProfit ? rr * perRisk * contracts : -perRisk * contracts;
      cum += pnl;
      return {
        x: new Date(t.createdAt).toLocaleString("ru-RU", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }),
        equity: Number(cum.toFixed(2)),
      };
    });
  }, [trades, rr]);

  // ---- Win rate по часам (0..23)
  const hourlyData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({ wins: 0, total: 0 }));
    for (const t of trades || []) {
      const h = new Date(t.createdAt).getHours();
      const b = buckets[h];
      b.total += 1;
      if (t.isProfit) b.wins += 1;
    }
    return buckets.map((b, h) => ({
      hour: h,
      winrate: b.total ? +(100 * b.wins / b.total).toFixed(1) : 0,
      total: b.total,
    }));
  }, [trades]);

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3>Графики</h3>
        <div className={styles.meta}>
          <span className={styles.dot} /> Отфильтровано: {trades?.length || 0} сделок
        </div>
      </div>

      <div className={styles.chartsGrid}>
        {/* Equity curve */}
        <div className={styles.chartBox}>
          <div className={styles.chartTitle}>Equity curve (оценка)</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={equityData} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis dataKey="x" tick={{ fill: "var(--muted-strong)", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "var(--muted-strong)", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)" }}
                       labelStyle={{ color: "var(--fg-strong)" }} />
              <Line type="monotone" dataKey="equity" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className={styles.hint}>Методика R: RR = {rr}. Изменяется в блоке «Аналитика».</div>
        </div>

        {/* Win rate by hour */}
        <div className={styles.chartBox}>
          <div className={styles.chartTitle}>Win rate по часам</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hourlyData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis dataKey="hour" tick={{ fill: "var(--muted-strong)", fontSize: 11 }} />
              <YAxis unit=" %" tick={{ fill: "var(--muted-strong)", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)" }}
                       labelStyle={{ color: "var(--fg-strong)" }}
                       formatter={(v, n, p) => [`${v} %`, `Win rate (N=${p.payload.total})`]} />
              <Bar dataKey="winrate" fill="var(--accent)" />
            </BarChart>
          </ResponsiveContainer>
          <div className={styles.hint}>Локальные часы (0–23). Учитываются только видимые (отфильтрованные) сделки.</div>
        </div>
      </div>
    </section>
  );
}
