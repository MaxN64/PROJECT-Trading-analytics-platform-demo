// src/hooks/useTradesApi.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listTrades as apiListTrades,
  createTrade as apiCreateTrade,
  updateTrade as apiUpdateTrade,
  deleteTrade as apiDeleteTrade,
} from "../lib/api";

/* ---------------------- конфиг лимита ---------------------- */
// Можно переопределить через .env:
//   VITE_TRADES_LIMIT=1500   (Vite)
//   REACT_APP_TRADES_LIMIT=1500 (CRA)
const ENV_LIMIT = Number(
  (import.meta?.env && import.meta.env.VITE_TRADES_LIMIT) ||
    (typeof process !== "undefined" &&
      process.env &&
      process.env.REACT_APP_TRADES_LIMIT) ||
    1000 // дефолт вместо прежних 200
);

/* ----------------------- нормализация ---------------------- */
function normalize(list) {
  const arr = Array.isArray(list) ? list : [];
  const withId = arr.map((t) => ({ ...t, id: t._id || t.id }));
  const n = withId.length;
  return withId.map((t, i) => ({
    ...t,
    index: typeof t.index === "number" ? t.index : n - i,
  }));
}

/* ------------------------- хук API ------------------------- */
export default function useTradesApi(initialQuery = {}) {
  const DEFAULT_QUERY = { limit: ENV_LIMIT, ...(initialQuery || {}) };

  const lastQueryRef = useRef(DEFAULT_QUERY);
  const [query, setQuery] = useState(DEFAULT_QUERY);

  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(
    async (override = null) => {
      const next = {
        ...lastQueryRef.current,
        ...(override || {}),
      };
      setLoading(true);
      setError(null);
      try {
        const items = await apiListTrades(next);
        setTrades(normalize(items));
        lastQueryRef.current = next;
        setQuery(next);
      } catch (e) {
        console.error(e);
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    refresh(); // первый запрос с limit из ENV/initialQuery
  }, [refresh]);

  /* --------------------- мутации --------------------- */
  const addTrade = useCallback(async (payload) => {
    const body = {
      createdAt: Date.now(),
      localTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...payload,
    };
    const created = await apiCreateTrade(body);
    setTrades((prev) => normalize([created, ...prev]));
    return created;
  }, []);

  const patchTrade = useCallback(async (id, patch) => {
    const updated = await apiUpdateTrade(id, patch);
    setTrades((prev) => {
      const idx = prev.findIndex((t) => (t.id || t._id) === id);
      if (idx === -1) return normalize(prev);
      const next = prev.slice();
      next[idx] = normalize([updated])[0];
      return next;
    });
    return updated;
  }, []);

  const toggleProfit = useCallback(async (id) => {
    let prevSnapshot = null;
    setTrades((prev) => {
      prevSnapshot = prev;
      return prev.map((t) =>
        (t.id || t._id) === id ? { ...t, isProfit: !t.isProfit } : t
      );
    });
    try {
      const current = prevSnapshot?.find((t) => (t.id || t._id) === id);
      const nextValue = !current?.isProfit;
      await apiUpdateTrade(id, { isProfit: nextValue });
    } catch (e) {
      setTrades(prevSnapshot || []);
      throw e;
    }
  }, []);

  const deleteTrade = useCallback(
    async (id) => {
      const prev = trades;
      setTrades((p) => p.filter((t) => (t.id || t._id) !== id));
      try {
        await apiDeleteTrade(id);
      } catch (e) {
        setTrades(prev);
        throw e;
      }
    },
    [trades]
  );

  /* ------------------- удобства для UI ------------------- */
  const loadMore = useCallback(
    async (step = 500) => {
      const next = {
        ...lastQueryRef.current,
        limit: (lastQueryRef.current.limit || ENV_LIMIT) + step,
      };
      await refresh(next);
    },
    [refresh]
  );

  const setFilter = useCallback(
    async (newFilter = {}) => {
      await refresh({
        ...newFilter,
        limit:
          newFilter.limit ??
          lastQueryRef.current.limit ??
          ENV_LIMIT,
      });
    },
    [refresh]
  );

  const count = useMemo(() => trades.length, [trades]);
  const hasHardLimit = useMemo(
    () => count >= (query.limit || ENV_LIMIT),
    [count, query.limit]
  );

  return {
    trades,
    count,
    loading,
    error,
    query,          // { limit, ... }
    refresh,
    loadMore,       // loadMore(500)
    hasHardLimit,   // true, если упёрлись в лимит
    setFilter,      // заменить фильтр (дата, результат и т.п.)
    addTrade,
    toggleProfit,
    deleteTrade,
    patchTrade,
  };
}
