// src/hooks/useFilteredTrades.js
import { useMemo } from "react";

export default function useFilteredTrades(trades = [], filters) {
  return useMemo(() => {
    if (!filters) return trades;

    const {
      dateFrom,
      dateTo,
      hourFrom,
      hourTo,
      outcome,
      conditions = [],
      matchAll = false,

      // новое
      side = "all",
      instrument = "",
      sortBy = "createdAt",
      sortDir = "desc",
    } = filters;

    const fromTs = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : null;
    const toTs   = dateTo   ? new Date(dateTo).setHours(23, 59, 59, 999) : null;

    const hasHour = typeof hourFrom === "number" || typeof hourTo === "number";
    const hFrom = typeof hourFrom === "number" ? hourFrom : 0;
    const hTo   = typeof hourTo   === "number" ? hourTo   : 23;

    const inst = instrument?.trim().toUpperCase();

    // фильтрация
    const filtered = (trades || []).filter((t) => {
      const created = new Date(t.createdAt);
      const ts = created.getTime();

      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;

      if (hasHour) {
        const h = created.getHours();
        if (hFrom <= hTo) {
          if (h < hFrom || h > hTo) return false;
        } else {
          // диапазон через полночь (например, 22–3)
          if (!(h >= hFrom || h <= hTo)) return false;
        }
      }

      if (outcome === "win" && !t.isProfit) return false;
      if (outcome === "loss" && !!t.isProfit) return false;

      if (side !== "all") {
        const s = String(t.side || "").toUpperCase();
        if (s !== side) return false;
      }

      if (inst) {
        const sym = String(t.instrument || "").toUpperCase().trim();
        // допускаем точное совпадение или префикс (ES, MES, FGBL и т.п.)
        if (!(sym === inst || sym.startsWith(inst))) return false;
      }

      if (conditions.length) {
        const src = Array.isArray(t.conditions) ? t.conditions : [];
        if (matchAll) {
          if (!conditions.every((c) => src.includes(c))) return false;
        } else {
          if (!conditions.some((c) => src.includes(c))) return false;
        }
      }

      return true;
    });

    // сортировка
    const dir = sortDir === "asc" ? 1 : -1;
    const num = (v) => (Number.isFinite(v) ? v : 0);

    const val = (t, key) => {
      switch (key) {
        case "contracts": return num(t.contracts ?? t.size);
        case "pnl":       return num(t.pnl);
        case "netR":      return num(t.netR);
        case "fee":       return num(t.fee);
        case "pips":      return num(t.pips);
        case "ddCash":    return num(t.drawdownCash ?? t.cashDrawdown);
        case "createdAt":
        default:          return new Date(t.createdAt).getTime();
      }
    };

    const sorted = filtered.slice().sort((a, b) => {
      const va = val(a, sortBy);
      const vb = val(b, sortBy);
      if (va === vb) return 0;
      return va > vb ? dir : -dir;
    });

    return sorted;
  }, [trades, filters]);
}
