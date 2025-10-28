import React, { useEffect, useMemo, useState } from "react";
import styles from "./Analytics.module.css";

/**
 * props:
 *  - trades: массив сделок из App (как в таблице)
 *  - defaultRR?: число (мультипликатор тейк-профита в R), по умолчанию 1
 */
export default function Analytics({ trades, defaultRR = 1 }) {
  const [rr, setRR] = useState(() => {
    const v = localStorage.getItem("mes-calc-rr");
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : defaultRR;
  });

  useEffect(() => {
    localStorage.setItem("mes-calc-rr", String(rr));
  }, [rr]);

  const stats = useMemo(() => {
    if (!Array.isArray(trades) || trades.length === 0) {
      return {
        total: 0, wins: 0, losses: 0, winRate: 0,
        avgWin: 0, avgLoss: 0, expectancy: 0,
        pnl: 0, equity: [],
        maxWinStreak: 0, maxLoseStreak: 0,
      };
    }

    let wins = 0, losses = 0;
    let sumWin = 0, sumLoss = 0;
    let pnl = 0;

    let curWinStreak = 0, curLoseStreak = 0;
    let maxWinStreak = 0, maxLoseStreak = 0;

    const equity = [];
    let cumulative = 0;

    // сортируем старые -> новые для кривой
    const rows = [...trades].sort((a,b) => a.createdAt - b.createdAt);

    for (const t of rows) {
      const perContractRisk = Number(t.perContractRisk ?? (t.stopPoints * (t.pricePerPoint || 1.25)));
      const contracts = Number(t.contracts || 0);

      // оценочный PnL на сделку:
      const profitValue = rr * perContractRisk * contracts;
      const lossValue = perContractRisk * contracts;

      const isProfit = !!t.isProfit;

      if (isProfit) {
        wins += 1;
        sumWin += profitValue;
        cumulative += profitValue;
        curWinStreak += 1;
        curLoseStreak = 0;
        if (curWinStreak > maxWinStreak) maxWinStreak = curWinStreak;
      } else {
        losses += 1;
        sumLoss += lossValue;
        cumulative -= lossValue;
        curLoseStreak += 1;
        curWinStreak = 0;
        if (curLoseStreak > maxLoseStreak) maxLoseStreak = curLoseStreak;
      }

      pnl = cumulative;
      equity.push({ ts: t.createdAt, value: cumulative });
    }

    const total = wins + losses;
    const winRate = total ? (wins / total) * 100 : 0;
    const avgWin = wins ? (sumWin / wins) : 0;
    const avgLoss = losses ? (sumLoss / losses) : 0;

    // Ожидаемость на сделку
    // E = p * avgWin - (1 - p) * avgLoss
    const p = total ? wins / total : 0;
    const expectancy = p * avgWin - (1 - p) * avgLoss;

    return {
      total, wins, losses, winRate,
      avgWin, avgLoss, expectancy,
      pnl, equity,
      maxWinStreak, maxLoseStreak,
    };
  }, [trades, rr]);

  const fmt = (n) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency", currency: "USD", maximumFractionDigits: 2,
    }).format(n);

  const fmtP = (n) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n) + " %";

  // Экспорт CSV
  const exportCSV = () => {
    const header = [
      "#","Время","SL (п.)","Контрактов","Прибыль?","Риск/контракт ($)","PnL(оценка,$)","Условия"
    ];
    const rows = [...trades].sort((a,b)=>b.createdAt - a.createdAt).map(t=>{
      const perContractRisk = Number(t.perContractRisk ?? (t.stopPoints * (t.pricePerPoint || 1.25)));
      const contracts = Number(t.contracts || 0);
      const profitValue = rr * perContractRisk * contracts;
      const lossValue = perContractRisk * contracts;
      const pnl = t.isProfit ? profitValue : -lossValue;

      return [
        t.index,
        new Date(t.createdAt).toLocaleString("ru-RU"),
        t.stopPoints,
        t.contracts,
        t.isProfit ? "прибыль" : "убыток",
        perContractRisk.toFixed(2),
        pnl.toFixed(2),
        (t.conditionsLabels || []).join(" | ")
      ];
    });
    const csv = [header, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3>Аналитика</h3>
        <div className={styles.controls}>
          <label className={styles.inline}>
            TP (в R):
            <input
              className={styles.input}
              inputMode="decimal"
              value={rr}
              onChange={e => {
                const v = e.target.value.trim();
                const n = Number(v.replace(",", "."));
                if (v === "" || (Number.isFinite(n) && n > 0 && n <= 10)) setRR(v);
              }}
              onBlur={()=>{
                const n = Number(String(rr).replace(",", "."));
                setRR(Number.isFinite(n) && n>0 ? n : 1);
              }}
            />
          </label>
          <button className={styles.btn} onClick={exportCSV}>Экспорт CSV</button>
        </div>
      </div>

      <div className={styles.grid}>
        <Stat label="Всего сделок" value={String(stats.total)} />
        <Stat label="Win rate" value={fmtP(stats.winRate)} />
        <Stat label="Средняя прибыль" value={fmt(stats.avgWin)} />
        <Stat label="Средний убыток" value={fmt(stats.avgLoss)} />
        <Stat label="Ожидаемость / сделка" value={fmt(stats.expectancy)} />
        <Stat label="PnL (оценка)" value={fmt(stats.pnl)} />
        <Stat label="Макс. серия побед" value={String(stats.maxWinStreak)} />
        <Stat label="Макс. серия убытков" value={String(stats.maxLoseStreak)} />
      </div>

      <p className={styles.hint}>
        Примечание: PnL и средние считаются по методике R-множеств.
        Выигрыш = <b>R × риск на контракт × кол-во контрактов</b>,
        проигрыш = <b>риск на контракт × кол-во контрактов</b>.
      </p>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}
