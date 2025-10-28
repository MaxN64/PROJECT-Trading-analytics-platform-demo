import { useEffect, useState } from "react";

const KEY = "mes-calc-trades";

export default function useTrades() {
  const [trades, setTrades] = useState([]);

  // load
  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY)) || [];
      setTrades(arr);
    } catch {
      setTrades([]);
    }
  }, []);

  // persist
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(trades));
  }, [trades]);

  const addTrade = (t) => {
    const nextIndex =
      (trades.reduce((m, x) => Math.max(m, x.index || 0), 0) || 0) + 1;

    const trade = {
      id: (crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      index: nextIndex,
      createdAt: Date.now(),
      ...t,
    };
    setTrades((arr) => [...arr, trade]);
  };

  const toggleProfit = (id) =>
    setTrades((arr) => arr.map((t) => (t.id === id ? { ...t, isProfit: !t.isProfit } : t)));

  const deleteTrade = (id) =>
    setTrades((arr) => arr.filter((t) => t.id !== id));

  return { trades, addTrade, toggleProfit, deleteTrade };
}
