import React, {
  useMemo,
  useState,
  Suspense,
  useDeferredValue,
  useEffect,
} from "react";
import styles from "./App.module.css";

/* Липкая шапка: теперь именно здесь живут тумблеры и кнопка TV */
import Header from "./components/Header";

/* Фильтры + основная логика/карточки */
import Filters from "./components/Filters";
import PositionCalculatorCard from "./components/PositionCalculatorCard";
import SettingsCard from "./components/SettingsCard";
import CurrentValuesCard from "./components/CurrentValuesCard";

import Analytics from "./components/Analytics";
import Charts from "./components/Charts";
import HeatmapTime from "./components/HeatmapTime";
import ConditionsStats from "./components/ConditionsStats";

import TradesTable from "./components/TradesTable";
import Conditions, {
  CONDITIONS as ALL_CONDITIONS,
} from "./components/Conditions";

import useSettings from "./hooks/useSettings";
import useTrades from "./hooks/useTradesApi";

import useComputedPosition from "./hooks/useComputedPosition";
import useDayRisk from "./hooks/useDayRisk";
import useFilteredTrades from "./hooks/useFilteredTrades";
import { CONTRACT_PRESETS } from "./lib/contracts";
import VisualMetrics from "./components/VisualMetrics";
import EconCalendarWithChart from "./components/EconCalendarWithChart";
import DualSpxChartsEmbed from "./components/DualSpxChartsEmbed";
import SummaryTotalsCard from "./components/analytics/SummaryTotalsCard";
import FibEntryPlanner from "./components/analytics/FibEntryPlanner";
import WeeklyPerformanceCard from "./components/analytics/WeeklyPerformanceCard";
import WeeklyPnlCard from "./components/analytics/WeeklyPnlCard";
import WeeklyPnlCard1 from "./components/analytics/WeeklyPnlCard1";
import WeeklyPnlCard2 from "./components/analytics/WeeklyPnlCard2";

/* Тумблеры производительности — используем только функции сохранения/загрузки */
import {
  loadPerfToggles,
  savePerfToggles,
  DEFAULT_TOGGLES,
} from "./components/PerfToggles";

/* ленивые тяжёлые карточки */
const EquityCurveCard = React.lazy(() =>
  import("./components/analytics/EquityCurveCard")
);
const ExpectancyCard = React.lazy(() =>
  import("./components/analytics/ExpectancyCard")
);
const DistributionCard = React.lazy(() =>
  import("./components/analytics/DistributionCard")
);
const StreaksCard = React.lazy(() =>
  import("./components/analytics/StreaksCard")
);
const BreakdownCard = React.lazy(() =>
  import("./components/analytics/BreakdownCard")
);
const FeesCard = React.lazy(() => import("./components/analytics/FeesCard"));
const SizeEffectCard = React.lazy(() =>
  import("./components/analytics/SizeEffectCard")
);
const DurationCard = React.lazy(() =>
  import("./components/analytics/DurationCard")
);
const DrawdownCard = React.lazy(() =>
  import("./components/analytics/DrawdownCard")
);
const PlaybookCard = React.lazy(() =>
  import("./components/analytics/PlaybookCard")
);
const HourCurveCard = React.lazy(() =>
  import("./components/analytics/HourCurveCard")
);

function CardSkeleton() {
  return (
    <div className={styles.cardSkel}>
      <div className={styles.cardSkelTitle} />
      <div className={styles.cardSkelBody} />
    </div>
  );
}

const CONDITION_LABELS = {
  fibo: "***Стратегия ФИБОНАЧИ",
  bruch_IB: "***Стратегия Пробой IB сессии",
  bruch_vwap: "***Стратегия Отскок от VWAP",
  bruch_vwapAB: "------Цена закрепилась выше 5м линий тренда",
  bruch_vwapAAB: "------Цена закрепилась ниже 5м линий тренда",
  bruch_vwapA: "------Первая пробившая 100EMA свеча с длинным телом",
  bruch_vwapB: "------Стоп в узле линии тренда",
  bruch_vwapС: "------Наличие треугольника CHOCK по тренду",
  bruch_vwapD: "------Время с 16:00-18:00",
  bruch_vwapF: "------Время с 19:30-21:00",
  bruch_vwapE: "------Наклон ЕМА100 за последние 5 свечей в сторону пробоя",

  bruch_chock: "***Стратегия Пробой CHOCK",
  ema100_up_min1: "Цена была выше EMA 100 на 1мин",
  ema100_down_min1: "Цена была ниже EMA 100 на 1мин",
  ema100_up_min5: "Цена была выше EMA 100 на 5мин",
  ema100_down_min5: "Цена была ниже EMA 100 на 5мин",
  ema100_up_min10: "Цена была выше EMA 100 на 10мин",
  ema100_down_min10: "Цена была ниже EMA 100 на 10мин",
  ema100_up_min15: "Цена была выше EMA 100 на 15мин",
  ema100_down_min15: "Цена была ниже EMA 100 на 15мин",
  ema200_up: "Цена была выше EMA 200 на 1 мин",
  ema200_down: "Цена была ниже EMA 200 на 1 мин",
  vwap_up: "Цена была выше дневной VWAP",
  vwap_down: "Цена была ниже дневной VWAP",
  trend1m_green: "На 1 мин был зелёный тренд",
  trend1m_red: "На 1 мин был красный тренд",
  trend5m_green: "На 5 мин был зелёный тренд",
  trend5m_red: "На 5 мин был красный тренд",
  trend15m_green: "На 15 мин был зелёный тренд",
  trend15m_red: "На 15 мин был красный тренд",
  chock_mid_1m: "Вход с середины треугольника CHOCK на 1 мин",
  break_2vwap_then_ema100: "Цена сначала пробила 2×VWAP, а потом EMA 100",
  min1_trade_line_ema100: "Линия тренда на 1мин пробила ЕМА100",
  min5_trade_line_ema100: "Линия тренда на 5мин пробила ЕМА100",
  min10_trade_line_ema100: "Линия тренда на 10мин пробила ЕМА100",
  min15_trade_line_ema100: "Линия тренда на 15мин пробила ЕМА100",
};

export default function App() {
  /* SAFE MODE через ?safe=1 */
  const safeMode = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get("safe") === "1";
    } catch {
      return false;
    }
  }, []);

  const settings = useSettings();
  const { trades, addTrade, toggleProfit, deleteTrade } = useTrades();

  const [stopPoints, setStopPoints] = useState("35");
  const [filters, setFilters] = useState(null);

  const computed = useComputedPosition({
    maxLoss: settings.maxLoss,
    pricePerPoint: settings.pricePerPoint,
    stopPoints,
    tpPoints: settings.tpPoints,
  });

  const dayRisk = useDayRisk({
    trades,
    dayRiskLimit: settings.dayRiskLimit,
    pricePerPointFallback: computed.pricePerPointN,
  });

  const filteredTrades = useFilteredTrades(trades, filters);
  const deferredTrades = useDeferredValue(filteredTrades);

  const heavyTrades = useMemo(
    () =>
      deferredTrades?.length > 3000
        ? deferredTrades.slice(0, 3000)
        : deferredTrades,
    [deferredTrades]
  );

  const conditionsDict = useMemo(() => {
    const d = {};
    for (const c of ALL_CONDITIONS) d[c.id] = c;
    return d;
  }, []);

  /* ТУМБЛЕРЫ ПРОИЗВОДИТЕЛЬНОСТИ — теперь передаются в Header */
  const [perf, setPerf] = useState(() => {
    const stored = loadPerfToggles();
    if (safeMode) {
      return {
        ...DEFAULT_TOGGLES,
        embeds: false,
        charts: false,
        stats: false,
        heavy: false,
        playbook: false,
      };
    }
    return stored;
  });
  useEffect(() => {
    if (!safeMode) savePerfToggles(perf);
  }, [perf, safeMode]);

  const handleSaveFromConditions = (
    conditionIds,
    isProfit,
    labelsFromPanel
  ) => {
    if (!computed.valid) return;
    const labels =
      Array.isArray(labelsFromPanel) && labelsFromPanel.length
        ? labelsFromPanel
        : (conditionIds || [])
            .map((id) => CONDITION_LABELS[id])
            .filter(Boolean);

    addTrade({
      stopPoints: computed.stopPointsN,
      pricePerPoint: computed.pricePerPointN,
      perContractRisk: computed.perContractRisk,
      contracts: computed.contracts,
      totalRisk: computed.totalRisk,
      isProfit: !!isProfit,
      conditions: conditionIds || [],
      conditionsLabels: labels,
    });
  };

  return (
    <div className={styles.app}>
      {/* Липкая верхняя панель со всем нужным */}
      <Header
        perfValue={perf}
        onPerfChange={setPerf}
        safeMode={safeMode}
        tvLabel="ES-chart-1m"
        tvSymbol="CME_MINI:ES1!"
        
      />

      {/* Контент страницы */}
      <div className={styles.content}>
        <Filters
          allConditions={ALL_CONDITIONS}
          totalCount={trades.length}
          onChange={setFilters}
        />
<div className={styles.topChartsRow}>
           

            {/* 2) ТВ-виджет №1 (как раньше через DualSpx) */}
            <DualSpxChartsEmbed
              symbol="SPX500USD"
              theme="dark"
              height={360}
            />

          </div>



        <main className={styles.grid}>
          <PositionCalculatorCard
            stopPoints={stopPoints}
            onChangeStop={setStopPoints}
            tpPoints={settings.tpPoints}
            onChangeTP={settings.setTpPoints}
            computed={computed}
            dayRisk={dayRisk}
            dayRiskLimit={settings.dayRiskLimit}
            onChangeDayLimit={settings.setDayRiskLimit}
          />

          <SettingsCard
            contract={settings.contract}
            onChangeContract={settings.setContract}
            maxLoss={settings.maxLoss}
            onChangeMaxLoss={settings.setMaxLoss}
            pricePerPoint={settings.pricePerPoint}
            onChangePricePerPoint={settings.setPricePerPoint}
            contractPresets={CONTRACT_PRESETS}
          />

          <CurrentValuesCard
            contractLabel={
              CONTRACT_PRESETS[settings.contract]?.label || settings.contract
            }
            pricePerPoint={settings.pricePerPoint}
            maxLoss={settings.maxLoss}
            stopPoints={stopPoints}
            tpPoints={settings.tpPoints}
          />

          <FibEntryPlanner defaultInstrument="MES" />

          <SummaryTotalsCard trades={filteredTrades} />

          <Analytics trades={filteredTrades} />

          {perf.embeds && (
            <>
              <EconCalendarWithChart
                height={420}
                widgetSrc="https://sslecal2.investing.com?ecoDayBackground=%232207ad&defaultFont=%23000000&innerBorderColor=%23054894&borderColor=%2338059e&columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&category=_employment,_economicActivity,_inflation,_credit,_centralBanks,_confidenceIndex,_balance,_Bonds&importance=3&features=datepicker,timezone,timeselector,filters&countries=4,17,39,72,6,37,52,5,12,35&calType=day&timeZone=16&lang=7"
                symbol="CME_MINI:ES1!"
                interval="60"
                theme="dark"
              />
              <section className="mt-3">
                {/* <DualSpxChartsEmbed
                  symbol="SPX500USD"
                  theme="dark"
                  height={420}
                /> */}
              </section>
            </>
          )}

          <WeeklyPerformanceCard trades={filteredTrades} />
          <WeeklyPnlCard trades={filteredTrades} />
          <WeeklyPnlCard1 trades={filteredTrades} />
          <WeeklyPnlCard2 trades={filteredTrades} />

          {perf.charts && <Charts trades={filteredTrades} />}
          {perf.charts && <HeatmapTime trades={filteredTrades} />}

          {perf.stats && (
            <ConditionsStats
              trades={filteredTrades}
              conditions={ALL_CONDITIONS}
            />
          )}
          {perf.stats && (
            <VisualMetrics
              trades={filteredTrades}
              conditions={ALL_CONDITIONS}
            />
          )}

          {perf.heavy && (
            <div className={styles.analyticsGrid}>
              <Suspense fallback={<CardSkeleton />}>
                <EquityCurveCard trades={heavyTrades} unit="R" />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <ExpectancyCard trades={heavyTrades} />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <DistributionCard trades={heavyTrades} metric="netR" />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <StreaksCard trades={heavyTrades} />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <BreakdownCard trades={heavyTrades} />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <FeesCard trades={heavyTrades} />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <SizeEffectCard trades={heavyTrades} />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <DurationCard trades={heavyTrades} />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <DrawdownCard trades={heavyTrades} />
              </Suspense>
              <Suspense fallback={<CardSkeleton />}>
                <HourCurveCard trades={heavyTrades} />
              </Suspense>
            </div>
          )}
        </main>

        <footer className={styles.footer}>
          Расчёты носят справочный характер и не являются инвестиционной
          рекомендацией.
        </footer>

        <TradesTable
          trades={filteredTrades}
          onToggleProfit={toggleProfit}
          onDelete={deleteTrade}
        />
        <Conditions onSave={handleSaveFromConditions} />
      </div>
    </div>
  );
}
