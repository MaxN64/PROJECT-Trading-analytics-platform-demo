import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import styles from "./TradeQualityAnalytics.module.css";

import useTrades from "../../hooks/useTradesApi";
import { vjListDays, vjGetDay, vjUpsertDay } from "../../lib/api";

// модал аналитики на момент входа
import EntryAnalyticsModal from "./EntryAnalyticsModal";

/* ================= helpers ================= */

const lineSplit = (txt) => (txt || "").split(/(?:\r\n|[\n\r])+/).filter(Boolean);
const detectDelimiter = (line) =>
  /\t/.test(line)
    ? "\t"
    : (line.match(/;/g) || []).length >= (line.match(/,/g) || []).length
    ? ";"
    : ",";

const toLocalDateKey = (d) => {
  const dt = new Date(d);
  if (isNaN(+dt)) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const guessDateFromFilename = (name = "") => {
  const m = name.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (!m) return "";
  const [, dd, mm, yy] = m;
  const Y = yy.length === 2 ? `20${yy}` : yy;
  return `${Y}-${mm}-${dd}`;
};

const toNum = (v) => {
  if (v == null) return 0;
  const s = String(v)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, "")
    .replace(/^"(.*)"$/, "$1")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const quantile = (sortedAsc, p) =>
  !sortedAsc.length ? 0 : sortedAsc[Math.floor((sortedAsc.length - 1) * Math.min(1, Math.max(0, p)))];

/** Нормализованный парсер времени из CSV: поддерживает ISO и `YYYY-MM-DD HH:mm:ss` (локальное) */
const parseCsvDateToMs = (raw) => {
  if (!raw) return NaN;
  const s = String(raw).trim();
  if (!s) return NaN;
  // ISO?
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : NaN;
  }
  // YYYY-MM-DD HH:mm:ss → трактуем как локальное время
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    const ms = Date.parse(s.replace(" ", "T"));
    return Number.isFinite(ms) ? ms : NaN;
  }
  // fallback для любых других представлений
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : NaN;
};

/* ---- CSV -> строки ---- */
function parseVJText(text, fileName = "") {
  const lines = lineSplit(text);
  if (!lines.length) return { rows: [], dates: [] };

  const delim = detectDelimiter(lines[0]);
  const header = lines[0].split(delim).map((s) => s.trim());

  const findIdx = (pats) => {
    for (let i = 0; i < header.length; i++) {
      const h = (header[i] || "").trim();
      for (const re of pats) if (re.test(h)) return i;
    }
    return -1;
  };

  const idxPrice = findIdx([/^price$/i, /^цена/i]);
  const idxVol = findIdx([/^volume$/i, /^об.?ём$/i, /^объем$/i]);
  const idxDAgg = findIdx([/now\s*delta.*aggr/i, /delta.*aggr/i, /агресс/i]);
  const idxDate = findIdx([/^date$/i, /time/i, /^время/i, /^дата/i]);

  const priceI = idxPrice !== -1 ? idxPrice : 1;
  const volI = idxVol !== -1 ? idxVol : 2;
  const daggI = idxDAgg !== -1 ? idxDAgg : 5;
  const dateI = idxDate !== -1 ? idxDate : -1;

  const rows = [];
  const dateKeys = new Set();

  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(delim);
    if (!cols.length) continue;

    const price = toNum(cols[priceI]);
    if (!price) continue;

    let datetime; // ISO для удобства вывода
    let tms = NaN; // число миллисекунд для точного сравнения

    if (dateI >= 0) {
      tms = parseCsvDateToMs(cols[dateI]);
      if (Number.isFinite(tms)) datetime = new Date(tms).toISOString();
    }

    const row = { price, volume: toNum(cols[volI]), deltaAgg: toNum(cols[daggI]) };
    if (Number.isFinite(tms)) row.tms = tms;
    if (datetime) row.datetime = datetime;

    rows.push(row);

    const dk = Number.isFinite(tms) ? toLocalDateKey(tms) : "";
    if (dk) dateKeys.add(dk);
  }

  if (!dateKeys.size && fileName) {
    const g = guessDateFromFilename(fileName);
    if (g) dateKeys.add(g);
  }
  return { rows, dates: Array.from(dateKeys) };
}

/* ---- профиль/обогащение/гейты ---- */
function buildProfile(vjRows, tick = 0.25) {
  const map = new Map();
  for (const r of vjRows) {
    const p = +Number(r.price).toFixed(2);
    map.set(p, (map.get(p) || 0) + (r.volume || 0));
  }
  const arr = Array.from(map, ([price, volume]) => ({ price, volume })).sort((a, b) => a.price - b.price);
  if (!arr.length) return { levels: [], POC: 0, VAL: 0, VAH: 0, volsSorted: [] };

  let pocIdx = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i].volume > arr[pocIdx].volume) pocIdx = i;

  const POC = arr[pocIdx].price;
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

function enrichTrades(trades, vjRows, tick = 0.25) {
  const profile = buildProfile(vjRows, tick);
  const P70_ES = quantile(profile.volsSorted, 0.7) * 0.1;

  const byPrice = new Map(vjRows.map((r) => [+Number(r.price).toFixed(2), r]));
  const allAbsDelta = vjRows.map((r) => Math.abs(r.deltaAgg || 0)).sort((a, b) => a - b);

  const getVol = (p) => byPrice.get(+p.toFixed(2))?.volume || 0;

  const enriched = trades.map((t) => {
    const p = +Number(t.entryPrice).toFixed(2);

    let row = byPrice.get(p);
    if (!row && vjRows.length) {
      let best = vjRows[0],
        bd = Math.abs(best.price - p);
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
      t.side === "LONG" ? getVol(p - tick) + getVol(p - 2 * tick) : getVol(p + tick) + getVol(p + 2 * tick);
    const thinBehind = median ? behind < 0.5 * median : false;

    return {
      ...t,
      vj_vol_at_entry: volAt,
      vj_vol_pctile: volPct,
      vj_is_HVN: volAt >= quantile(profile.volsSorted, 0.8),
      vj_is_LVN: volAt <= quantile(profile.volsSorted, 0.2),
      vj_in_value_area: inVA,
      vj_dist_to_poc_ticks: distToPOC,
      vj_va_edge_dist_ticks: vaEdgeDist,
      vj_delta_agg: deltaAgg,
      vj_delta_rank: deltaRank,
      vj_delta_opposes_side: t.side === "LONG" ? deltaAgg < 0 : deltaAgg > 0,
      vj_edge_slope: edgeSlope,
      vj_thin_behind: thinBehind,
      vj_vol_es_equiv: volAt * 0.1,
      P70_ES,
      POC: profile.POC,
      VAL: profile.VAL,
      VAH: profile.VAH,
    };
  });

  return { enriched, profile, P70_ES };
}

const passesFade = (tr) => {
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

function calcKPIs(rows) {
  const arr = rows.filter((r) => typeof r.R === "number");
  const n = arr.length || 1;
  const wins = arr.filter((r) => r.R > 0);
  const losses = arr.filter((r) => r.R <= 0);

  const wr = wins.length / n;
  const avgWin = wins.reduce((s, r) => s + r.R, 0) / Math.max(1, wins.length);
  const avgLoss = Math.abs(losses.reduce((s, r) => s + r.R, 0)) / Math.max(1, losses.length);
  const payoff = (isFinite(avgWin) ? avgWin : 0) / Math.max(1e-9, isFinite(avgLoss) ? avgLoss : 0);
  const expectancy = wr * (avgWin || 0) - (1 - wr) * (avgLoss || 0);

  return { count: arr.length, wr, payoff, expectancy };
}

/* ================= component ================= */

export default function TradeQualityAnalytics({ trades, tickSize = 0.25 }) {
  const { patchTrade, refresh } = useTrades();

  // инструмент по умолчанию — MES
  const instruments = useMemo(() => {
    const s = new Set(["MES"]);
    for (const t of trades || []) if (t.instrument) s.add(String(t.instrument).toUpperCase());
    return Array.from(s);
  }, [trades]);
  const [instrument, setInstrument] = useState("MES");

  // загрузка VJ-дней из БД
  const [vjByDay, setVjByDay] = useState({});
  const [daysOrder, setDaysOrder] = useState([]);
  const [busy, setBusy] = useState(false);

  // гейт: Fade / Breakout
  const [mode, setMode] = useState("FADE");

  // фильтр вида
  const [view, setView] = useState("ALL"); // ALL | PASS | FAIL

  // сортировка по умолчанию — большие номера сверху
  const [sort, setSort] = useState({ field: "index", dir: "desc" });

  // модал «на момент входа»
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTrade, setModalTrade] = useState(null);
  const [modalVJRows, setModalVJRows] = useState([]);

  // полноэкранный режим
  const [isFs, setIsFs] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    const b = document.body;
    if (isFs) b.style.overflow = "hidden";
    else b.style.overflow = "";
    return () => (b.style.overflow = "");
  }, [isFs]);

  // подтянуть дни
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      try {
        const list = await vjListDays({ instrument });
        const order = list.map((d) => d.day).sort((a, b) => b.localeCompare(a)); // последние сверху
        const map = {};
        for (const dk of order) {
          const full = await vjGetDay({ day: dk, instrument });
          map[dk] = { rows: full.rows || [], profile: full.profile || {} };
        }
        if (!cancelled) {
          setVjByDay(map);
          setDaysOrder(order);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setVjByDay({});
          setDaysOrder([]);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [instrument]);

  // сделки по дням — используем ИМЕННО время входа openDate, а не createdAt
  const tradesByDay = useMemo(() => {
    const m = new Map();
    for (const t of trades || []) {
      if (instrument && String(t.instrument).toUpperCase() !== instrument) continue;

      const openTime = t.openDate || t.open_date || t.open_datetime || t.createdAt; // fallback
      const dk = toLocalDateKey(openTime);
      if (!dk) continue;

      const arr = m.get(dk) || [];
      arr.push({
        id: t.id || t._id,
        index: Number(t.index ?? 0),
        datetime: openTime, // важно: время ВХОДА
        side: t.side === "BUY" ? "LONG" : "SHORT",
        entryPrice: Number(t.openPrice),
        R: Number(t.netR),
        pnl: Number(t.pnl),
      });
      m.set(dk, arr);
    }
    return m;
  }, [trades, instrument]);

  // список всех дней
  const allDays = useMemo(() => {
    const s = new Set([...Array.from(tradesByDay.keys()), ...daysOrder]);
    return Array.from(s).sort((a, b) => b.localeCompare(a)); // новые сверху
  }, [tradesByDay, daysOrder]);

  // подготовить секции
  const dayRefs = useRef({});
  const sections = useMemo(() => {
    const result = [];

    for (const dk of allDays) {
      const dayTrades = (tradesByDay.get(dk) || []).filter((x) => Number.isFinite(x.entryPrice));
      const vjRows = vjByDay[dk]?.rows || [];
      const { enriched, profile } = enrichTrades(dayTrades, vjRows, tickSize);

      // применяем гейт
      let withGate = enriched.map((t) => {
        const gate = mode === "FADE" ? passesFade(t) : passesBreakout(t);
        return { ...t, levelScore: levelScore(t), pass: gate.pass, flags: gate.flags };
      });

      // сортировка
      withGate.sort((a, b) => {
        const dir = sort.dir === "asc" ? 1 : -1;
        switch (sort.field) {
          case "index":
            return (Number(a.index) - Number(b.index)) * dir;
          case "datetime":
            return new Date(a.datetime) - new Date(b.datetime) * dir;
          case "pnl":
            return ((a.pnl || 0) - (b.pnl || 0)) * dir;
          case "side":
            return a.side.localeCompare(b.side) * dir;
          case "price":
            return (a.entryPrice - b.entryPrice) * dir;
          case "R":
            return ((a.R || 0) - (b.R || 0)) * dir;
          case "score":
            return ((a.levelScore || 0) - (b.levelScore || 0)) * dir;
          default:
            return (Number(a.index) - Number(b.index)) * dir;
        }
      });

      // фильтр вида
      if (view === "PASS") withGate = withGate.filter((r) => r.pass);
      if (view === "FAIL") withGate = withGate.filter((r) => !r.pass);

      result.push({
        day: dk,
        rows: withGate,
        profile,
        vjCount: vjRows.length,
        kAll: calcKPIs(withGate),
        kPass: calcKPIs(withGate.filter((r) => r.pass)),
      });
    }

    return result;
  }, [allDays, tradesByDay, vjByDay, mode, sort, tickSize, view]);

  const allEnriched = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  /* ===== CSV загрузка -> сохранить дни в БД ===== */
  async function onPickCsv(e) {
    const files = e.target.files;
    if (!files || !files.length) return;

    const readers = Array.from(files).map(
      (file) =>
        new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve({ name: file.name, text: String(r.result || "") });
          r.readAsText(file);
        })
    );
    const blobs = await Promise.all(readers);

    setBusy(true);
    try {
      const bucket = {};

      for (const { name, text } of blobs) {
        const { rows, dates } = parseVJText(text, name);
        if (!rows.length) continue;

        if (dates.length) {
          for (const d of dates) {
            const part = rows.filter((r) => toLocalDateKey(r.tms ?? r.datetime) === d || (!r.datetime && d));
            if (!part.length) continue;
            bucket[d] = (bucket[d] || []).concat(part);
          }
        } else {
          const fallback = guessDateFromFilename(name) || "";
          const dk = fallback || "unknown";
          bucket[dk] = (bucket[dk] || []).concat(rows);
        }
      }

      const days = Object.keys(bucket);
      for (const dk of days) {
        const rows = bucket[dk];
        await vjUpsertDay({ day: dk, instrument, rows, tickSize });
      }

      // обновить локальный кэш
      const list = await vjListDays({ instrument });
      const order = list.map((d) => d.day).sort((a, b) => b.localeCompare(a));
      const map = {};
      for (const dk of order) {
        const full = await vjGetDay({ day: dk, instrument });
        map[dk] = { rows: full.rows || [], profile: full.profile || {} };
      }
      setVjByDay(map);
      setDaysOrder(order);
    } catch (err) {
      console.error(err);
      alert(`Ошибка при сохранении CSV: ${String(err.message || err)}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  /* ===== Сохранение метрик во все показанные строки ===== */
  async function saveMetricsAll() {
    if (!allEnriched.length) return;
    try {
      for (const r of allEnriched) {
        const patch = {
          vj_profile_date: toLocalDateKey(r.datetime),
          vj_profile_poc: r.POC,
          vj_profile_val: r.VAL,
          vj_profile_vah: r.VAH,
          vj_vol_at_entry: r.vj_vol_at_entry,
          vj_vol_pctile: +((r.vj_vol_pctile ?? 0).toFixed(4)),
          vj_is_hvn: !!r.vj_is_HVN,
          vj_is_lvn: !!r.vj_is_LVN,
          vj_in_value_area: !!r.vj_in_value_area,
          vj_dist_to_poc_ticks: r.vj_dist_to_poc_ticks,
          vj_va_edge_dist_ticks: r.vj_va_edge_dist_ticks,
          vj_delta_agg: r.vj_delta_agg,
          vj_delta_rank: +((r.vj_delta_rank ?? 0).toFixed(4)),
          vj_delta_opposes_side: !!r.vj_delta_opposes_side,
          vj_edge_slope: r.vj_edge_slope,
          vj_thin_behind: !!r.vj_thin_behind,
          vj_level_score: r.levelScore,
          vj_gate: mode,
          vj_gate_pass: !!r.pass,
          vj_flags: r.flags || [],
        };
        // eslint-disable-next-line no-await-in-loop
        await patchTrade(r.id, patch);
      }
      await refresh();
      alert(`Сохранено метрик: ${allEnriched.length} (инструмент ${instrument})`);
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении метрик");
    }
  }

  /* ===== Навигация по дням (вверх/вниз) ===== */

  const [curIdx, setCurIdx] = useState(0);

  function findScrollParent(el) {
    let p = el?.parentElement;
    while (p) {
      const sh = p.scrollHeight,
        ch = p.clientHeight;
      const overflowY = getComputedStyle(p).overflowY;
      if (sh > ch && (overflowY === "auto" || overflowY === "scroll")) return p;
      p = p.parentElement;
    }
    return window;
  }

  useEffect(() => {
    const r = rootRef.current;
    if (!r) return;
    const scrollEl = findScrollParent(r);
    const onScroll = () => {
      const entries = sections.map((sec, i) => {
        const node = dayRefs.current[sec.day];
        if (!node) return { i, top: Infinity };
        const rect = node.getBoundingClientRect();
        return { i, top: Math.abs(rect.top - 96) };
      });
      entries.sort((a, b) => a.top - b.top);
      if (entries.length) setCurIdx(entries[0].i);
    };
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [sections.length]);

  const goToIdx = (idx) => {
    const clamped = Math.max(0, Math.min(sections.length - 1, idx));
    const day = sections[clamped]?.day;
    const node = dayRefs.current[day];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const goPrevDay = () => goToIdx(curIdx - 1);
  const goNextDay = () => goToIdx(curIdx + 1);

  /* ===== таблица ===== */

  const headerCell = (code, label) => (
    <th
      onClick={() =>
        setSort((s) => (s.field === code ? { field: code, dir: s.dir === "asc" ? "desc" : "asc" } : { field: code, dir: "asc" }))
      }
      className={`${styles.th} ${sort.field === code ? styles.sorted : ""}`}
      title="Сортировать"
    >
      {label}
      {sort.field === code ? <span className={styles.sortArrow}>{sort.dir === "asc" ? "▲" : "▼"}</span> : null}
    </th>
  );

  return (
    <div ref={rootRef} className={`${styles.wrap} ${isFs ? styles.fullscreen : ""}`}>
      <div className={styles.top}>
        <div>
          <h3>Level Quality &amp; Filters</h3>
          <div className={styles.sub}>
            Инструмент:&nbsp;
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              className={styles.instrumentSelect}
              disabled={busy}
            >
              {instruments.map((ins) => (
                <option key={ins} value={ins}>
                  {ins}
                </option>
              ))}
            </select>
            &nbsp;· дней в БД: <b>{daysOrder.length}</b>
          </div>
        </div>

        <div className={styles.actions}>
          <label className={styles.csvBtn}>
            Загрузить Volume Journal CSV
            <input type="file" accept=".csv,text/csv" multiple onChange={onPickCsv} />
          </label>

          {/* Режим гейта */}
          <div className={styles.modes}>
            <button className={`${styles.modeBtn} ${mode === "FADE" ? styles.on : ""}`} onClick={() => setMode("FADE")}>
              Fade
            </button>
            <button
              className={`${styles.modeBtn} ${mode === "BREAKOUT" ? styles.on : ""}`}
              onClick={() => setMode("BREAKOUT")}
            >
              Breakout
            </button>
          </div>

          {/* Вид списка */}
          <div className={styles.view}>
            <button className={`${styles.viewBtn} ${view === "ALL" ? styles.on : ""}`} onClick={() => setView("ALL")}>
              Все
            </button>
            <button className={`${styles.viewBtn} ${view === "PASS" ? styles.on : ""}`} onClick={() => setView("PASS")}>
              Только pass
            </button>
            <button className={`${styles.viewBtn} ${view === "FAIL" ? styles.on : ""}`} onClick={() => setView("FAIL")}>
              Только fail
            </button>
          </div>

          <button className={styles.saveBtn} onClick={saveMetricsAll} disabled={!allEnriched.length || busy}>
            {busy ? "Обновляю…" : `Сохранить метрики (${instrument})`}
          </button>

          {/* маленькая кнопка полноэкрана */}
          <button
            className={styles.fsBtn}
            title={isFs ? "Выйти из полноэкрана" : "На весь экран"}
            onClick={() => setIsFs((v) => !v)}
          >
            {isFs ? "⤺" : "⤢"}
          </button>
        </div>
      </div>

      {/* KPIs по текущему видимому набору */}
      <section className={styles.kpis} aria-label="KPIs">
        {(() => {
          const kAll = calcKPIs(allEnriched);
          const kPass = calcKPIs(allEnriched.filter((r) => r.pass));
          const K = ({ label, value }) => (
            <div className={styles.card}>
              <div className={styles.k}>{label}</div>
              <div className={styles.v}>{value}</div>
            </div>
          );
          return (
            <>
              <K label="Сделок" value={kAll.count} />
              <K label="Win-rate" value={`${(kAll.wr * 100).toFixed(1)}%`} />
              <K label="Payoff" value={`${kAll.payoff.toFixed(2)}×`} />
              <K label="Expectancy" value={`${kAll.expectancy.toFixed(2)} R`} />
              <K label="Прошло фильтры" value={allEnriched.filter((r) => r.pass).length} />
              <K label="Win-rate (pass)" value={`${(kPass.wr * 100).toFixed(1)}%`} />
              <K label="Payoff (pass)" value={`${kPass.payoff.toFixed(2)}×`} />
              <K label="Expectancy (pass)" value={`${kPass.expectancy.toFixed(2)} R`} />
            </>
          );
        })()}
      </section>

      {/* таблица */}
      <section className={styles.tableWrap}>
        <div className={styles.tableScroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th /> {/* колонка с лупой */}
                {headerCell("index", "#")}
                {headerCell("datetime", "Дата")}
                {headerCell("pnl", "P&L ($)")}
                {headerCell("side", "Side")}
                {headerCell("price", "Price")}
                {headerCell("R", "R")}
                {headerCell("score", "Score")}
                <th>Gate</th>
                <th>VA</th>
                <th>POC Δt</th>
                <th>Vol pct</th>
                <th>Δ agg</th>
                <th>Δ rank</th>
                <th>Thin</th>
                <th>Flags</th>
              </tr>
            </thead>

            <tbody>
              {sections.length === 0 ? (
                <tr>
                  <td colSpan={16} className={styles.mono} style={{ opacity: 0.7, padding: 12 }}>
                    Нет данных: либо нет сделок по инструменту, либо не загружены профили дней.
                  </td>
                </tr>
              ) : (
                sections.map((sec, secIdx) => (
                  <React.Fragment key={sec.day}>
                    {/* Разделитель дня (и якорь для навигации) */}
                    <tr ref={(el) => (dayRefs.current[sec.day] = el)}>
                      <td colSpan={16} style={{ padding: "10px 8px 6px", borderTop: "2px solid var(--border)" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                          <b>{sec.day.split("-").reverse().join(".")}</b>
                          <span style={{ opacity: 0.8 }}>
                            POC <b>{sec.profile.POC ? sec.profile.POC.toFixed(2) : "—"}</b> · VAL{" "}
                            <b>{sec.profile.VAL ? sec.profile.VAL.toFixed(2) : "—"}</b> · VAH{" "}
                            <b>{sec.profile.VAH ? sec.profile.VAH.toFixed(2) : "—"}</b> · CSV: <b>{sec.vjCount}</b> уровней
                          </span>
                          {sec.vjCount === 0 && (
                            <span style={{ color: "var(--muted-strong)" }}>— нет профиля в БД, загрузите CSV</span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Строки дня */}
                    {sec.rows.length === 0 ? (
                      <tr>
                        <td colSpan={16} className={styles.mono} style={{ opacity: 0.7, padding: "6px 8px 12px" }}>
                          Сделок за этот день нет.
                        </td>
                      </tr>
                    ) : (
                      sec.rows.map((r) => (
                        <tr key={`${sec.day}-${r.id}`} className={r.pass ? styles.pass : styles.fail}>
                          <td>
                            <button
                              className={styles.ghostBtn}
                              title="Аналитика на момент входа"
                              onClick={() => {
                                setModalTrade(r);
                                setModalVJRows(vjByDay[sec.day]?.rows || []);
                                setModalOpen(true);
                              }}
                            >
                              🔎
                            </button>
                          </td>
                          <td className={styles.mono}>{r.index}</td>
                          <td className={styles.mono}>{new Date(r.datetime).toLocaleString()}</td>
                          <td className={r.pnl >= 0 ? styles.pnlWin : styles.pnlLoss}>
                            {Number.isFinite(r.pnl) ? r.pnl.toFixed(2) : "—"}
                          </td>
                          <td className={r.side === "LONG" ? styles.longColor : styles.shortColor}>{r.side}</td>
                          <td className={styles.mono}>{r.entryPrice.toFixed(2)}</td>
                          <td className={r.R >= 0 ? styles.win : styles.loss}>
                            {Number.isFinite(r.R) ? r.R.toFixed(2) : "—"}
                          </td>
                          <td>
                            <b>{r.levelScore?.toFixed(0)}</b>/10
                          </td>

                          {/* Gate */}
                          <td>{r.pass ? <span className={styles.gatePass}>PASS</span> : <span className={styles.gateFail}>FAIL</span>}</td>

                          <td>
                            {r.vj_in_value_area ? "inVA" : "outVA"}{" "}
                            {r.vj_va_edge_dist_ticks != null ? `(${r.vj_va_edge_dist_ticks}t)` : ""}
                          </td>
                          <td className={styles.mono}>{r.vj_dist_to_poc_ticks}</td>
                          <td className={styles.mono}>{(r.vj_vol_pctile ?? 0).toFixed(2)}</td>
                          <td className={styles.delta}>{r.vj_delta_agg}</td>
                          <td className={styles.mono}>{(r.vj_delta_rank ?? 0).toFixed(2)}</td>
                          <td>{r.vj_thin_behind ? "yes" : "no"}</td>
                          <td className={styles.flags}>
                            {(r.flags || []).map((f, i) => (
                              <span key={i} className={styles.badge}>
                                {f}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))
                    )}

                    {secIdx < sections.length - 1 && (
                      <tr>
                        <td colSpan={16} style={{ height: 8 }} />
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* плавающая навигация по дням */}
      {sections.length > 1 && (
        <div className={styles.floatNav}>
          <button className={styles.floatBtn} onClick={goPrevDay} title="К предыдущему дню">
            ↑
          </button>
          <div className={styles.floatInfo}>
            {curIdx + 1}/{sections.length}
          </div>
          <button className={styles.floatBtn} onClick={goNextDay} title="К следующему дню">
            ↓
          </button>
        </div>
      )}

      {/* кнопка выхода из полноэкрана */}
      {isFs && (
        <button className={styles.fsClose} title="Закрыть" onClick={() => setIsFs(false)}>
          ×
        </button>
      )}

      {/* модал аналитики на момент входа */}
      <EntryAnalyticsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        trade={modalTrade}
        vjRows={modalVJRows}
        tickSize={tickSize}
        mode={mode}
      />
    </div>
  );
}

TradeQualityAnalytics.propTypes = {
  trades: PropTypes.arrayOf(PropTypes.object).isRequired,
  tickSize: PropTypes.number,
};
