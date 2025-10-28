import { useMemo } from "react";

export default function useDayRisk({ trades, dayRiskLimit, pricePerPointFallback }) {
  const num = (v) => {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };

  const dayKey = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  const todayKey = dayKey(Date.now());

  return useMemo(() => {
    const limit = num(dayRiskLimit);
    if (!(limit > 0)) return { limit: NaN, used: 0, left: NaN, count: 0, stop: false };

    let used = 0;
    let count = 0;
    for (const t of trades || []) {
      if (dayKey(t.createdAt) !== todayKey) continue;
      count += 1;
      const perRisk =
        Number(t.perContractRisk) ||
        (Number(t.stopPoints) * (Number(t.pricePerPoint) || pricePerPointFallback || 0));
      const contracts = Number(t.contracts || 0);
      if (!t.isProfit) used += perRisk * contracts;
    }
    const left = Math.max(0, limit - used);
    const stop = used >= limit - 1e-9;
    return { limit, used, left, count, stop };
  }, [trades, dayRiskLimit, pricePerPointFallback, todayKey]);
}
