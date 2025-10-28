import React, { useMemo, useState } from "react";
import s from "./FibEntryPlanner.module.css";

/**
 * Планировщик входа по уровням Фибо с разбивкой 40/30/30.
 * - Ввод: low, high, side, extraTicks, maxRisk$, instrument(+tickSize/tickValue), TP цена.
 * - Логика SHORT: метки уровней показываем .500/.382/.236 (как ты просил),
 *   лонг — такие же метки. Расчёты для шорта зеркальные.
 * - Контракты распределяем по долям 0.4/0.3/0.3 с "умным" округлением,
 *   чтобы суммарный риск при стопе не превышал maxRisk$.
 */

const INSTRUMENTS = [
  { id: "MES", label: "MES (Micro E-mini S&P 500)", tickSize: 0.25, tickValue: 1.25 },
  { id: "ES",  label: "ES (E-mini S&P 500)",        tickSize: 0.25, tickValue: 12.5  },
  { id: "FGBL",label: "FGBL (Euro-Bund)",          tickSize: 0.01, tickValue: 10    },
];

const SHARES = [0.4, 0.3, 0.3];           // 40/30/30
const FIB_LONG =  [0.500, 0.382, 0.236];
const FIB_SHORT = [0.500, 0.382, 0.236];  // подписи одинаковые, как ты просил

function fmtMoney(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);
}
function fmt(n) {
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return String(Math.round(v * 100) / 100);
}

export default function FibonacciEntryPlanner() {
  const [side, setSide] = useState("long"); // long | short
  const [low, setLow] = useState(6455);
  const [high, setHigh] = useState(6491);
  const [extraTicks, setExtraTicks] = useState(5);
  const [maxRisk, setMaxRisk] = useState(300);
  const [tpPrice, setTpPrice] = useState(6495);

  const [instrId, setInstrId] = useState("MES");
  const instr = INSTRUMENTS.find((x) => x.id === instrId) || INSTRUMENTS[0];

  const [manualTicks, setManualTicks] = useState(false);
  const [tickSize, setTickSize] = useState(instr.tickSize);
  const [tickValue, setTickValue] = useState(instr.tickValue);

  // синхронизация preset → поля
  const effectiveTickSize  = manualTicks ? Number(tickSize)  : instr.tickSize;
  const effectiveTickValue = manualTicks ? Number(tickValue) : instr.tickValue;

  // диапазон волны
  const range = Math.abs(high - low);

  // стоп-уровень цены
  const stopPrice = useMemo(() => {
    if (side === "long") {
      return low - extraTicks * effectiveTickSize;
    } else {
      return high + extraTicks * effectiveTickSize;
    }
  }, [side, low, high, extraTicks, effectiveTickSize]);

  // уровни фибо (цены входа)
  const fibLevels = useMemo(() => {
    const labels = side === "long" ? FIB_LONG : FIB_SHORT; // подписи одинаковые
    return labels.map((lv) => {
      // цена уровня
      const price =
        side === "long"
          ? low + range * lv
          : high - range * lv;

      // расстояние до стопа в тиках
      const ticksToStop =
        side === "long"
          ? Math.max(0, Math.round((price - stopPrice) / effectiveTickSize))
          : Math.max(0, Math.round((stopPrice - price) / effectiveTickSize));

      const riskPerContract = ticksToStop * effectiveTickValue;

      return {
        label: lv.toFixed(3).replace(/0+$/,'').replace(/\.$/,''),
        price,
        stopPrice,
        ticksToStop,
        riskPerContract,
      };
    });
  }, [side, low, high, range, stopPrice, effectiveTickSize, effectiveTickValue]);

  // распределение контрактов 40/30/30 с "умным" округлением,
  // чтобы суммарный риск при стопе ≤ maxRisk
  const plan = useMemo(() => {
    // доли риска в долларах
    const riskShares = SHARES.map((p) => p * maxRisk);

    // сырые значения контрактов и базовая "floor" часть
    const raw = fibLevels.map((lv, i) => (lv.riskPerContract > 0 ? riskShares[i] / lv.riskPerContract : 0));
    const base = raw.map((x) => Math.floor(x));

    // сколько риска уже заняли
    let riskUsed = base.reduce((sum, c, i) => sum + c * fibLevels[i].riskPerContract, 0);
    let contracts = base.slice();

    // добавляем контракты по убыванию дробной части, не превышая лимит риска
    const rema = raw.map((x, i) => ({ i, frac: x - Math.floor(x) }))
                    .sort((a, b) => b.frac - a.frac);

    for (const { i } of rema) {
      const addRisk = fibLevels[i].riskPerContract;
      if (addRisk <= 0) continue;
      if (riskUsed + addRisk <= maxRisk + 1e-6) {
        contracts[i] += 1;
        riskUsed += addRisk;
      }
    }

    const totalContracts = contracts.reduce((a, b) => a + b, 0);
    const totalRisk = contracts.reduce(
      (sum, c, i) => sum + c * fibLevels[i].riskPerContract,
      0
    );

    return { contracts, totalRisk, totalContracts };
  }, [fibLevels, maxRisk]);

  // Итоговая средняя цена (вес по контрактам)
  const avgPrice = useMemo(() => {
    const totalC = plan.totalContracts || 0;
    if (!totalC) return null;
    const s = fibLevels.reduce((acc, lv, i) => acc + plan.contracts[i] * lv.price, 0);
    return s / totalC;
  }, [plan, fibLevels]);

  // Проверочный блок TP-сценария: P&L на предполагаемом TP
  const tpScenario = useMemo(() => {
    if (!tpPrice || plan.totalContracts === 0) {
      return { pnl: 0, rr: 0, tp: tpPrice || 0 };
    }
    let pnl = 0;
    fibLevels.forEach((lv, i) => {
      const ticks = side === "long"
        ? Math.round((tpPrice - lv.price) / effectiveTickSize)
        : Math.round((lv.price - tpPrice) / effectiveTickSize);
      const one = ticks * effectiveTickValue;
      pnl += one * plan.contracts[i];
    });
    const rr = plan.totalRisk > 0 ? pnl / plan.totalRisk : 0;
    return { pnl, rr, tp: tpPrice };
  }, [tpPrice, side, fibLevels, plan, effectiveTickSize, effectiveTickValue]);

  return (
    <section className={s.card}>
      <header className={s.header}>
        <h3>Fibonacci Entry Planner</h3>
      </header>

      <div className={s.grid}>
        {/* направление */}
        <div className={s.field}>
          <label>Направление</label>
          <div className={s.dirRow}>
            <button
              type="button"
              className={`${s.dirBtn} ${side === "long" ? s.longOn : ""}`}
              onClick={() => setSide("long")}
            >
              Long
            </button>
            <button
              type="button"
              className={`${s.dirBtn} ${side === "short" ? s.shortOn : ""}`}
              onClick={() => setSide("short")}
            >
              Short
            </button>
          </div>
        </div>

        {/* low / high + swap */}
        <div className={s.field}>
          <label>Нижняя точка (0)</label>
          <input className={s.input} value={low} onChange={(e)=>setLow(Number(e.target.value))}/>
        </div>
        <div className={s.field}>
          <label>Верхняя точка (1)</label>
          <input className={s.input} value={high} onChange={(e)=>setHigh(Number(e.target.value))}/>
        </div>

        <div className={s.field}>
          <label> </label>
          <button
            className={s.swapBtn}
            onClick={() => { setLow(high); setHigh(low); }}
            type="button"
          >
            Поменять местами
          </button>
          <div className={s.range}>Диапазон: {fmt(range)}</div>
        </div>

        {/* стоп за экстремумом + рассчитанный уровень стопа */}
        <div className={s.field}>
          <label>Стоп за экстремумом</label>
          <input
            className={s.input}
            type="number"
            min="0"
            value={extraTicks}
            onChange={(e)=>setExtraTicks(Number(e.target.value))}
          />
          <div className={s.hint}>
            Long — ниже <b>LOW</b>, Short — выше <b>HIGH</b>
          </div>
        </div>
        <div className={s.field}>
          <label>Стоп-цена (расч.)</label>
          <input className={s.input} value={fmt(stopPrice)} readOnly/>
        </div>

        {/* риск & инструмент */}
        <div className={s.field}>
          <label>Макс. риск ($)</label>
          <input
            className={s.input}
            type="number"
            min="0"
            value={maxRisk}
            onChange={(e)=>setMaxRisk(Number(e.target.value))}
          />
        </div>

        <div className={s.field}>
          <label>Инструмент</label>
          <select
            className={s.input}
            value={instrId}
            onChange={(e) => {
              const v = e.target.value;
              setInstrId(v);
              if (!manualTicks) {
                const p = INSTRUMENTS.find((x)=>x.id===v);
                if (p) {
                  setTickSize(p.tickSize);
                  setTickValue(p.tickValue);
                }
              }
            }}
          >
            {INSTRUMENTS.map((i)=>(
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>

          <label className={s.manualChk}>
            <input
              type="checkbox"
              checked={manualTicks}
              onChange={(e)=>setManualTicks(e.target.checked)}
            />
            <span>Задать tickSize/tickValue вручную</span>
          </label>
        </div>

        <div className={s.field}>
          <label>tickSize</label>
          <input
            className={s.input}
            type="number"
            step="0.01"
            value={tickSize}
            onChange={(e)=>setTickSize(Number(e.target.value))}
            disabled={!manualTicks}
          />
        </div>
        <div className={s.field}>
          <label>tickValue ($/tick)</label>
          <input
            className={s.input}
            type="number"
            step="0.01"
            value={tickValue}
            onChange={(e)=>setTickValue(Number(e.target.value))}
            disabled={!manualTicks}
          />
        </div>

        <div className={s.field}>
          <label>TP цена</label>
          <input
            className={s.input}
            value={tpPrice}
            onChange={(e)=>setTpPrice(Number(e.target.value))}
            placeholder="например 5000.00"
          />
        </div>
      </div>

      {/* таблица уровней */}
      <div className={s.table} role="table">
        <div className={`${s.tr} ${s.th}`} role="row">
          <div className={s.td}>Уровень</div>
          <div className={s.td}>Цена</div>
          <div className={s.td}>Стоп-уровень</div>
          <div className={s.td}>До стопа</div>
          <div className={s.td}>Риск / контракт</div>
          <div className={s.td}>Доля риска</div>
          <div className={s.td}>Контрактов</div>
        </div>

        {fibLevels.map((lv, idx) => (
          <div key={idx} className={s.tr} role="row">
            <div className={s.td}>
              <span className={s.badge}>.{lv.label}</span> retr
            </div>
            <div className={s.td}>{fmt(lv.price)}</div>
            <div className={s.td}>{fmt(stopPrice)}</div>
            <div className={s.td}>{lv.ticksToStop} тиков</div>
            <div className={s.td}>{fmtMoney(lv.riskPerContract)}</div>
            <div className={s.td}>{fmtMoney(SHARES[idx] * maxRisk)}</div>
            <div className={s.td}>{plan.contracts[idx]}</div>
          </div>
        ))}

        <div className={`${s.tr} ${s.ft}`} role="row">
          <div className={s.td}><b>Итого</b></div>
          <div className={s.td}>{avgPrice ? fmt(avgPrice) : "—"}</div>
          <div className={s.td}></div>
          <div className={s.td}></div>
          <div className={s.td}></div>
          <div className={s.td}>
            <div
              className={`${s.riskBadge} ${
                plan.totalRisk <= maxRisk ? s.good : s.bad
              }`}
            >
              Риск при стопе: {fmtMoney(plan.totalRisk)}{" "}
              <span className={s.sub}>
                (лимит {fmtMoney(maxRisk)}, Δ {fmtMoney(maxRisk - plan.totalRisk)})
              </span>
            </div>
          </div>
          <div className={s.td}><b>{plan.totalContracts}</b></div>
        </div>
      </div>

      {/* блок TP-сценария */}
      <div className={s.tpBox}>
        <div className={s.tpItem}>
          <span className={s.muted}>TP:</span>&nbsp;{fmt(tpScenario.tp)}
        </div>
        <div className={s.tpItem}>
          <span className={s.muted}>Потенц. прибыль:</span>&nbsp;
          <b className={tpScenario.pnl >= 0 ? s.win : s.loss}>
            {fmtMoney(tpScenario.pnl)}
          </b>
        </div>
        <div className={s.tpItem}>
          <span className={s.muted}>RR:</span>&nbsp;<b>{fmt(tpScenario.rr)}</b>
        </div>
      </div>

      <div className={s.note}>
        Прибыль/убыток на TP считается по каждой частичной покупке относительно её цены входа.
      </div>
    </section>
  );
}
