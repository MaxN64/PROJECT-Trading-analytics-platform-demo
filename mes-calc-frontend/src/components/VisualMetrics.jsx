import React, { useMemo } from "react";
import Card from "./Card";
import styles from "./VisualMetrics.module.css";

/**
 * props:
 *  - trades: отфильтрованные сделки
 *  - conditions: массив { id, label }
 *  - topK?: число (сколько наиболее частых условий включать в матрицу), по умолч. 6
 */
export default function VisualMetrics({ trades = [], conditions = [], topK = 7 }) {
  const condLabel = useMemo(() => {
    const map = new Map();
    conditions.forEach(c => map.set(c.id, c.label));
    return map;
  }, [conditions]);

  // -------- PIE (win / loss) ----------
  const { wins, losses, total, winPct, lossPct } = useMemo(() => {
    let w = 0, l = 0;
    for (const t of trades) t.isProfit ? w++ : l++;
    const tot = w + l;
    return {
      wins: w,
      losses: l,
      total: tot,
      winPct: tot ? (w / tot) * 100 : 0,
      lossPct: tot ? (l / tot) * 100 : 0,
    };
  }, [trades]);

  // -------- HEATMAP (combos) ----------
  // 1) частоты по одиночным условиям
  const topIds = useMemo(() => {
    const freq = new Map();
    for (const t of trades) {
      const set = new Set(t.conditions || []);
      set.forEach(id => freq.set(id, (freq.get(id) || 0) + 1));
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, topK);
  }, [trades, topK]);

  // 2) матрица пар (i,j) -> {tot, win}
  const matrix = useMemo(() => {
    const res = new Map(); // key `${a}|${b}` -> {total, wins}
    const has = (arr, id) => (arr ? arr.includes(id) : false);

    for (const t of trades) {
      const arr = t.conditions || [];
      for (let i = 0; i < topIds.length; i++) {
        for (let j = 0; j < topIds.length; j++) {
          if (i === j) continue;
          const a = topIds[i], b = topIds[j];
          if (has(arr, a) && has(arr, b)) {
            const key = `${a}|${b}`;
            const cur = res.get(key) || { total: 0, wins: 0 };
            cur.total += 1;
            if (t.isProfit) cur.wins += 1;
            res.set(key, cur);
          }
        }
      }
    }
    return res;
  }, [trades, topIds]);

  const maxCellTotal = useMemo(() => {
    let m = 0;
    matrix.forEach(v => { if (v.total > m) m = v.total; });
    return m || 1;
  }, [matrix]);

  const cellStyle = (rate, count) => {
    const h = Math.round((rate / 100) * 120); // 0..120: красный->зелёный
    const sat = 70;
    const baseL = 45;
    const k = Math.min(1, count / maxCellTotal);
    const light = baseL + (1 - k) * 15; // 45..60
    return {
      backgroundColor: `hsl(${h} ${sat}% ${light}%)`,
      color: rate > 50 ? "#0a0a0a" : "#fff",
    };
  };

  // pie geometry
  const R = 60;
  const C = 2 * Math.PI * R;
  const winLen = (winPct / 100) * C;

  return (
    <Card title="Визуальные метрики">
      <div className={styles.wrap}>
        {/* --- Pie --- */}
        <div className={styles.pieBlock}>
          <div className={styles.pieTitle}>Распределение сделок</div>
          <div className={styles.pieChart}>
            <svg viewBox="0 0 160 160" width="160" height="160" className={styles.pieSvg}>
              <g transform="translate(80,80) rotate(-90)">
                <circle r={R} cx="0" cy="0" fill="none" stroke="var(--neutral-700)" strokeWidth="22" strokeDasharray={`${C} ${C}`} />
                <circle r={R} cx="0" cy="0" fill="none" stroke="var(--accent-500)" strokeWidth="22" strokeDasharray={`${winLen} ${C - winLen}`} />
              </g>
            </svg>
            <div className={styles.pieCenter}>
              <div className={styles.pct}>{total ? `${winPct.toFixed(0)}%` : "—"}</div>
              <div className={styles.note}>win-rate</div>
            </div>
          </div>
          <div className={styles.pieLegend}>
            <div className={styles.lItem}>
              <span className={styles.dot} style={{ background: "var(--accent-500)" }} />
              Прибыль: <b>{wins}</b> ({winPct.toFixed(0)}%)
            </div>
            <div className={styles.lItem}>
              <span className={styles.dot} style={{ background: "var(--neutral-700)" }} />
              Убыток: <b>{losses}</b> ({lossPct.toFixed(0)}%)
            </div>
          </div>
        </div>

        {/* --- Heatmap --- */}
        <div className={styles.hmBlock}>
          <div className={styles.hmHeader}>
            Тепловая карта win-rate по сочетаниям условий
            <span className={styles.hmSub}> (top {topIds.length} по частоте)</span>
          </div>

          {topIds.length >= 2 ? (
            <div className={styles.hmTableWrap}>
              <table
                className={styles.hmTable}
                style={{ "--cols": topIds.length }}
              >
                {/* управляем ширинами столбцов через colgroup */}
                <colgroup>
                  <col className={styles.colFirst} />
                  {topIds.map(id => <col key={"c-"+id} className={styles.col} />)}
                </colgroup>

                <thead>
                  <tr>
                    <th />
                    {topIds.map(id => (
                      <th key={"col-"+id} title={condLabel.get(id) || id}>
                        {condLabel.get(id) || id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topIds.map((rowId) => (
                    <tr key={"row-"+rowId}>
                      <th title={condLabel.get(rowId) || rowId}>
                        {condLabel.get(rowId) || rowId}
                      </th>
                      {topIds.map((colId) => {
                        if (rowId === colId) return <td key={rowId+"|"+colId} className={styles.diag}>—</td>;
                        const key = `${rowId}|${colId}`;
                        const cell = matrix.get(key);
                        const tot = cell?.total || 0;
                        const wr = tot ? (cell.wins / tot) * 100 : 0;
                        return (
                          <td
                            key={rowId+"|"+colId}
                            className={styles.cell}
                            style={tot ? cellStyle(wr, tot) : undefined}
                            title={`${condLabel.get(rowId) || rowId} + ${condLabel.get(colId) || colId}\nВсего: ${tot}\nWin-rate: ${tot ? wr.toFixed(1) + "%" : "—"}`}
                          >
                            {tot ? `${wr.toFixed(0)}%` : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.legendRow}>
                <span>0%</span>
                <div className={styles.gradientBar} />
                <span>100%</span>
              </div>
            </div>
          ) : (
            <div className={styles.hmEmpty}>Недостаточно данных для матрицы сочетаний.</div>
          )}
        </div>
      </div>
    </Card>
  );
}
