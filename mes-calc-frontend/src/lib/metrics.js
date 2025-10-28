// Простейшие утилиты расчёта метрик исполнения и KPI

export function ticksToDollars(ticks, tickValue) {
  if (!Number.isFinite(ticks) || !Number.isFinite(tickValue)) return 0;
  return ticks * tickValue;
}

// risk per contract в $: (entry - plannedStop) в тиках * tickValue
export function riskPerContract$(entry, plannedStop, tickSize, tickValue) {
  if (![entry, plannedStop, tickSize, tickValue].every(Number.isFinite)) return 0;
  const ticks = Math.round((entry - plannedStop) / tickSize);
  return Math.abs(ticks) * tickValue;
}

export function netPnL$(fills = [], fees$ = 0) {
  // fills: [{side:"buy"|"sell", price, qty}]
  if (!Array.isArray(fills) || !fills.length) return 0;
  let pos = 0, cash = 0;
  for (const f of fills) {
    const s = f.side === "buy" ? 1 : -1;
    pos += s * f.qty;
    cash -= s * f.qty * f.price;
  }
  // если позиция закрыта (pos ~ 0): прибыль = -cash; иначе не считаем
  const pnl = Math.abs(pos) < 1e-6 ? -cash : 0;
  return pnl - (Number(fees$) || 0);
}

// R-модуль для сделки (по факту выхода)
export function realizedR(entry, exit, plannedStop, tickSize, tickValue, qty = 1) {
  if (![entry, exit, plannedStop, tickSize, tickValue, qty].every(Number.isFinite)) return 0;
  const riskPerContract = riskPerContract$(entry, plannedStop, tickSize, tickValue);
  if (!riskPerContract) return 0;
  const pnlPerContract$ = (exit - entry) / tickSize * tickValue;
  return (pnlPerContract$ * qty) / (riskPerContract * qty);
}

// MAE/MFE в R (на основе экстремумов до выхода)
export function maeMfeR(entry, lowBeforeExit, highBeforeExit, plannedStop, isLong, tickSize, tickValue) {
  const risk$ = riskPerContract$(entry, plannedStop, tickSize, tickValue);
  if (!risk$) return { maeR: 0, mfeR: 0 };
  const adverseTicks  = isLong ? (entry - lowBeforeExit) / tickSize : (highBeforeExit - entry) / tickSize;
  const favorableTicks= isLong ? (highBeforeExit - entry) / tickSize : (entry - lowBeforeExit) / tickSize;
  return {
    maeR: (ticksToDollars(adverseTicks, tickValue)) / risk$,
    mfeR: (ticksToDollars(favorableTicks, tickValue)) / risk$,
  };
}

// KPI / expectancy
export function kpiFromTrades(trades = []) {
  const rs = trades.map(t => Number(t.netR)).filter(n => Number.isFinite(n));
  const n = rs.length;
  if (!n) return { n:0, winP:0, avgWinR:0, avgLossR:0, expectancy:0, payoff:0 };
  const wins = rs.filter(r => r > 0);
  const losses = rs.filter(r => r < 0);
  const winP = wins.length / n;
  const avgWinR = wins.length ? (wins.reduce((a,b)=>a+b,0) / wins.length) : 0;
  const avgLossR= losses.length ? (losses.reduce((a,b)=>a+b,0) / losses.length) : 0;
  const expectancy = rs.reduce((a,b)=>a+b,0) / n;
  const payoff = avgLossR ? (avgWinR / Math.abs(avgLossR)) : 0;
  return { n, winP, avgWinR, avgLossR, expectancy, payoff };
}
