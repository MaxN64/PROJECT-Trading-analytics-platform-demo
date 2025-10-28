import React, { useMemo } from "react";
import PropTypes from "prop-types";
import styles from "./EntryAnalyticsModal.module.css";

/* ===== helpers ===== */
const toNum = (v) => {
  const n = Number(String(v).replace(/\u00A0/g, " ").replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const quantile = (sortedAsc, p) =>
  !sortedAsc.length ? 0 : sortedAsc[Math.floor((sortedAsc.length - 1) * Math.min(1, Math.max(0, p)))];

const parseMs = (x) => {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (!x) return NaN;
  const s = String(x).trim();
  if (!s) return NaN;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : NaN;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    const ms = Date.parse(s.replace(" ", "T"));
    return Number.isFinite(ms) ? ms : NaN;
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : NaN;
};

function buildProfile(vjRows, tick = 0.25) {
  const map = new Map();
  for (const r of vjRows || []) {
    const p = +Number(r.price).toFixed(2);
    map.set(p, (map.get(p) || 0) + (toNum(r.volume) || 0));
  }
  const arr = Array.from(map, ([price, volume]) => ({ price, volume })).sort((a, b) => a.price - b.price);
  if (!arr.length) return { levels: [], POC: 0, VAL: 0, VAH: 0, volsSorted: [] };

  // POC
  let pocIdx = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i].volume > arr[pocIdx].volume) pocIdx = i;
  const POC = arr[pocIdx].price;

  // 70% вокруг POC
  const total = arr.reduce((s, r) => s + r.volume, 0);
  const target = 0.7 * total;

  let cum = arr[pocIdx].volume,
    L = pocIdx - 1,
    R = pocIdx + 1,
    VAL = POC,
    VAH = POC;

  while (cum < target && (L >= 0 || R < arr.length)) {
    const vL = L >= 0 ? arr[L].volume : -1;
    const vR = R < arr.length ? arr[R].volume : -1;
    if (vL > vR) {
      cum += vL;
      VAL = arr[L].price;
      L--;
    } else if (vR > vL) {
      cum += vR;
      VAH = arr[R].price;
      R++;
    } else {
      if (L >= 0) {
        cum += vL;
        VAL = arr[L].price;
        L--;
      }
      if (cum >= target) break;
      if (R < arr.length) {
        cum += vR;
        VAH = arr[R].price;
        R++;
      }
    }
  }

  const volsSorted = arr.map((r) => r.volume).sort((a, b) => a - b);
  return { levels: arr, POC, VAL, VAH, volsSorted };
}

function enrichOne(trade, vjRows, tick = 0.25) {
  if (!trade) return null;

  const profile = buildProfile(vjRows, tick);
  const P70_ES = quantile(profile.volsSorted, 0.7) * 0.1;

  const byPrice = new Map((vjRows || []).map((r) => [+Number(r.price).toFixed(2), r]));
  const allAbsDelta = (vjRows || [])
    .map((r) => Math.abs(toNum(r.deltaAgg) || 0))
    .sort((a, b) => a - b);
  const getVol = (p) => byPrice.get(+p.toFixed(2))?.volume || 0;

  const p = +Number(trade.entryPrice).toFixed(2);
  let row = byPrice.get(p);
  if (!row && (vjRows || []).length) {
    let best = vjRows[0],
      bd = Math.abs(vjRows[0].price - p);
    for (const r of vjRows) {
      const d = Math.abs(r.price - p);
      if (d < bd) {
        best = r;
        bd = d;
      }
    }
    row = best;
  }

  const volAt = row?.volume || 0;
  const volPct = profile.volsSorted.length
    ? profile.volsSorted.findIndex((v) => v >= volAt) / (profile.volsSorted.length - 1)
    : 0;

  const deltaAgg = row?.deltaAgg ?? 0;
  const deltaRank = allAbsDelta.length
    ? allAbsDelta.findIndex((v) => v >= Math.abs(deltaAgg)) / (allAbsDelta.length - 1)
    : 0;

  const inVA = p >= profile.VAL && p <= profile.VAH;
  const distToPOC = Math.round(Math.abs(p - profile.POC) / tick);
  const vaEdgeDist = Math.min(
    Math.round(Math.abs(p - profile.VAL) / tick),
    Math.round(Math.abs(profile.VAH - p) / tick)
  );

  const edgeSlope = volAt - Math.max(getVol(p + tick), getVol(p - tick));
  const median = profile.volsSorted[Math.floor(profile.volsSorted.length / 2)] || 0;
  const behind =
    trade.side === "LONG" ? getVol(p - tick) + getVol(p - 2 * tick) : getVol(p + tick) + getVol(p + 2 * tick);
  const thinBehind = median ? behind < 0.5 * median : false;

  return {
    ...trade,
    profile,
    P70_ES,
    vj_vol_at_entry: volAt,
    vj_vol_pctile: volPct,
    vj_is_HVN: volAt >= quantile(profile.volsSorted, 0.8),
    vj_is_LVN: volAt <= quantile(profile.volsSorted, 0.2),
    vj_in_value_area: inVA,
    vj_dist_to_poc_ticks: distToPOC,
    vj_va_edge_dist_ticks: vaEdgeDist,
    vj_delta_agg: deltaAgg,
    vj_delta_rank: deltaRank,
    vj_delta_opposes_side: trade.side === "LONG" ? deltaAgg < 0 : deltaAgg > 0,
    vj_edge_slope: edgeSlope,
    vj_thin_behind: thinBehind,
    vj_vol_es_equiv: volAt * 0.1,
  };
}

/* ===== гейты и скор ===== */
const passesFade = (tr) => {
  if (!tr) return { pass: false, flags: [] };
  const flags = [];
  const atEdge = (tr.vj_va_edge_dist_ticks ?? 99) <= 4;
  const base =
    tr.vj_in_value_area === false &&
    atEdge &&
    ((tr.side === "LONG" && (tr.vj_is_LVN || (tr.vj_vol_pctile ?? 1) <= 0.2)) ||
      (tr.side === "SHORT" && (tr.vj_is_HVN || (tr.vj_vol_pctile ?? 0) >= 0.8)));
  if (base) flags.push("edge VA");
  const deltaOpp = tr.vj_delta_opposes_side && (tr.vj_delta_rank ?? 0) >= 0.7;
  if (deltaOpp) flags.push("delta opp (≥p70)");
  const extra = tr.vj_thin_behind || (tr.vj_edge_slope ?? 0) * (tr.side === "LONG" ? 1 : -1) > 0;
  if (extra) flags.push("thin/ledge");
  const avoid = (tr.vj_is_HVN && tr.side === "LONG") || (tr.vj_is_HVN && (tr.vj_dist_to_poc_ticks ?? 0) <= 6);
  return { pass: base && deltaOpp && extra && !avoid, flags: base && deltaOpp && extra && !avoid ? flags : [] };
};

const passesBreakout = (tr) => {
  if (!tr) return { pass: false, flags: [] };
  const flags = [];
  const inVA = !!tr.vj_in_value_area;
  const volPct = tr.vj_vol_pctile ?? 0.5;
  const base = inVA === false && volPct > 0.2 && volPct < 0.8;
  if (base) flags.push("outside & mid-vol");
  const deltaWith = !tr.vj_delta_opposes_side && (tr.vj_delta_rank ?? 0) >= 0.7;
  if (deltaWith) flags.push("delta with (≥p70)");
  const notThin = tr.vj_thin_behind === false;
  if (notThin) flags.push("not thin");
  return { pass: base && deltaWith && notThin, flags: base && deltaWith && notThin ? flags : [] };
};

const levelScore = (tr) => {
  if (!tr) return 0;
  let s = 0;
  if ((tr.vj_va_edge_dist_ticks ?? 99) <= 4) s += 2;
  if (tr.side === "LONG" && tr.vj_is_LVN) s += 2;
  if (tr.side === "SHORT" && tr.vj_is_HVN) s += 2;
  if (tr.vj_delta_opposes_side && (tr.vj_delta_rank ?? 0) >= 0.7) s += 2;
  if ((tr.vj_edge_slope ?? 0) * (tr.side === "LONG" ? 1 : -1) > 0) s += 1;
  if (tr.vj_thin_behind) s += 1;
  if ((tr.vj_dist_to_poc_ticks ?? 0) >= 8) s += 1;
  if ((tr.vj_vol_es_equiv ?? 0) >= (tr.P70_ES ?? 0)) s += 1;
  return Math.max(0, Math.min(10, s));
};

/* ===== компонент ===== */
export default function EntryAnalyticsModal({ open, onClose, trade, vjRows, tickSize = 0.25, mode = "FADE" }) {
  // время входа сделки
  const tradeMs = useMemo(() => parseMs(trade?.datetime), [trade]);

  // строки профиля ДО входа (если в CSV/БД есть время)
  const rowsAtEntry = useMemo(() => {
    if (!Array.isArray(vjRows) || !vjRows.length) return [];
    if (!Number.isFinite(tradeMs)) return vjRows; // нет времени → берём весь день

    const filtered = vjRows.filter((r) => {
      const ms = Number.isFinite(r.tms) ? r.tms : parseMs(r.datetime || r.Date || r.date || r.time);
      return Number.isFinite(ms) ? ms <= tradeMs : true; // если у строки нет времени — не выкидываем
    });

    return filtered.length ? filtered : vjRows; // защита: если парсинг не удался, откат к EOD
  }, [vjRows, tradeMs]);

  // Метрики
  const enrichedAtEntry = useMemo(() => enrichOne(trade, rowsAtEntry, tickSize), [trade, rowsAtEntry, tickSize]);
  const enrichedEOD = useMemo(() => enrichOne(trade, vjRows || [], tickSize), [trade, vjRows, tickSize]);

  const gateEntry = useMemo(
    () => (mode === "FADE" ? passesFade(enrichedAtEntry) : passesBreakout(enrichedAtEntry)),
    [mode, enrichedAtEntry]
  );
  const gateEOD = useMemo(
    () => (mode === "FADE" ? passesFade(enrichedEOD) : passesBreakout(enrichedEOD)),
    [mode, enrichedEOD]
  );
  const scoreEntry = useMemo(() => levelScore(enrichedAtEntry), [enrichedAtEntry]);
  const scoreEOD = useMemo(() => levelScore(enrichedEOD), [enrichedEOD]);

  if (!open || !trade) return null;

  const fmt = (n, d = 2) => (Number.isFinite(+n) ? (+n).toFixed(d) : "—");

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headLeft}>
            <div className={styles.title}>Entry analytics</div>
            <div className={styles.sub}>
              #{trade.index} · {trade.side} @ {fmt(trade.entryPrice)} ·{" "}
              {trade.datetime ? new Date(trade.datetime).toLocaleString() : "без времени"}
            </div>
          </div>

          <div className={styles.headRight}>
            <span className={styles.modeChip}>{mode}</span>
            <span className={`${styles.modeChip} ${gateEntry.pass ? styles.pass : styles.fail}`}>
              {gateEntry.pass ? "PASS" : "FAIL"} · at entry
            </span>
            <span className={`${styles.modeChip} ${gateEOD.pass ? styles.pass : styles.fail}`}>
              {gateEOD.pass ? "PASS" : "FAIL"} · EOD
            </span>
          </div>

          <button className={styles.x} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Body */}
        <div className={styles.grid}>
          {/* Left: At entry */}
          <div>
            <div className={styles.colTitle}>At entry</div>
            <div className={styles.cards}>
              <div className={styles.card}>
                <div className={styles.k}>POC (at entry)</div>
                <div className={styles.v}>{fmt(enrichedAtEntry?.profile?.POC)}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>VAL (at entry)</div>
                <div className={styles.v}>{fmt(enrichedAtEntry?.profile?.VAL)}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>VAH (at entry)</div>
                <div className={styles.v}>{fmt(enrichedAtEntry?.profile?.VAH)}</div>
              </div>

              <div className={styles.card}>
                <div className={styles.k}>Vol pct (entry)</div>
                <div className={styles.v}>{fmt(enrichedAtEntry?.vj_vol_pctile)}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>Δ agg (entry)</div>
                <div className={styles.v}>{fmt(enrichedAtEntry?.vj_delta_agg, 0)}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>Δ rank (entry)</div>
                <div className={styles.v}>{fmt(enrichedAtEntry?.vj_delta_rank)}</div>
              </div>

              <div className={styles.card}>
                <div className={styles.k}>Edge dist (t)</div>
                <div className={styles.v}>{fmt(enrichedAtEntry?.vj_va_edge_dist_ticks, 0)}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>POC Δt</div>
                <div className={styles.v}>{fmt(enrichedAtEntry?.vj_dist_to_poc_ticks, 0)}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>Thin behind</div>
                <div className={styles.v}>{enrichedAtEntry?.vj_thin_behind ? "yes" : "no"}</div>
              </div>

              <div className={styles.card}>
                <div className={styles.k}>Score</div>
                <div className={styles.v}>
                  <b>{scoreEntry}</b>/10
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>Gate</div>
                <div className={`${styles.v} ${gateEntry.pass ? styles.pass : styles.fail}`}>
                  {gateEntry.pass ? "PASS" : "FAIL"}
                </div>
                {!!gateEntry.flags?.length && (
                  <div className={styles.flags}>
                    {gateEntry.flags.map((f, i) => (
                      <span key={i} className={styles.badge}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: EOD */}
          <div>
            <div className={styles.colTitle}>EOD (весь день)</div>
            <div className={styles.cards}>
              <div className={styles.card}>
                <div className={styles.k}>POC (EOD)</div>
                <div className={styles.v}>{fmt(enrichedEOD?.profile?.POC)}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>VAL (EOD)</div>
                <div className={styles.v}>{fmt(enrichedEOD?.profile?.VAL)}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>VAH (EOD)</div>
                <div className={styles.v}>{fmt(enrichedEOD?.profile?.VAH)}</div>
              </div>

              <div className={styles.card}>
                <div className={styles.k}>Score</div>
                <div className={styles.v}>
                  <b>{scoreEOD}</b>/10
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.k}>Gate</div>
                <div className={`${styles.v} ${gateEOD.pass ? styles.pass : styles.fail}`}>
                  {gateEOD.pass ? "PASS" : "FAIL"}
                </div>
                {!!gateEOD.flags?.length && (
                  <div className={styles.flags}>
                    {gateEOD.flags.map((f, i) => (
                      <span key={i} className={styles.badge}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.tips}>
          <div className={styles.tipTitle}>Как это считать «на момент входа»</div>
          Если в CSV есть колонка времени (на ваших скринах «Date»), то блок <b>At entry</b> строится по строкам с датой ≤
          времени входа. Если времени нет в сделке или в CSV, весь левый блок совпадает с EOD.
        </div>
      </div>
    </div>
  );
}

EntryAnalyticsModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  trade: PropTypes.object,
  vjRows: PropTypes.arrayOf(PropTypes.object),
  tickSize: PropTypes.number,
  mode: PropTypes.oneOf(["FADE", "BREAKOUT"]),
};
