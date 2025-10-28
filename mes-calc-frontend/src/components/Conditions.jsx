import React, { useEffect, useMemo, useState } from "react";
import styles from "./Conditions.module.css";

/**
 * ВАЖНО: Экспортируем список условий, ВКЛЮЧАЯ НАПРАВЛЕНИЕ,
 * чтобы фильтры / аналитика могли им пользоваться.
 * Сам компонент чек-листа НЕ показывает эти два пункта — у него отдельные круглые кнопки.
 */
export const CONDITIONS = [
  { id: "fibo", label: "***Стратегия ФИБОНАЧИ" },
  { id: "bruch_IB", label: "***Стратегия Пробой IB сессии" },
  { id: "bruch_vwap", label: "***Стратегия Отскок от VWAP" },
  { id: "bruch_vwapAB", label: "------Цена закрепилась выше 5м линий тренда" },
  { id: "bruch_vwapAAB", label: "------Цена закрепилась ниже 5м линий тренда" },
  { id: "bruch_vwapA", label: "------Первая пробившая 100EMA свеча с длинным телом" },
  { id: "bruch_vwapB", label: "------Стоп в узле линии тренда" },
  { id: "bruch_vwapC", label: "------Наличие треугольника CHOCK по тренду" },
  { id: "bruch_vwapD", label: "------Время с 16:00-18:00" },
  { id: "bruch_vwapF", label: "------Время с 19:30-21:00" },
  { id: "bruch_vwapE", label: "------Наклон ЕМА100 за последние 5 свечей в сторону пробоя" },
  
  { id: "bruch_chock", label: "***Стратегия Пробой CHOCK" },
  { id: "ema100_up_min1", label: "Цена была выше EMA 100 на 1мин" },
  { id: "ema100_down_min1", label: "Цена была ниже EMA 100 на 1мин" },
  { id: "ema100_up_min5", label: "Цена была выше EMA 100 на 5мин" },
  { id: "ema100_down_min5", label: "Цена была ниже EMA 100 на 5мин" },
  { id: "ema100_up_min10", label: "Цена была выше EMA 100 на 10мин" },
  { id: "ema100_down_min10", label: "Цена была ниже EMA 100 на 10мин" },
  { id: "ema100_up_min15", label: "Цена была выше EMA 100 на 15мин" },
  { id: "ema100_down_min15", label: "Цена была ниже EMA 100 на 15мин" },
  { id: "ema200_up", label: "Цена была выше EMA 200 на 1 мин" },
  { id: "ema200_down", label: "Цена была ниже EMA 200 на 1 мин" },
  { id: "vwap_up", label: "Цена была выше дневной VWAP" },
  { id: "vwap_down", label: "Цена была ниже дневной VWAP" },
  { id: "trend1m_green", label: "На 1 мин был зелёный тренд" },
  { id: "trend1m_red", label: "На 1 мин был красный тренд" },
  { id: "trend5m_green", label: "На 5 мин был зелёный тренд" },
  { id: "trend5m_red", label: "На 5 мин был красный тренд" },
  { id: "trend15m_green", label: "На 15 мин был зелёный тренд" },
  { id: "trend15m_red", label: "На 15 мин был красный тренд" },
  { id: "chock_mid_1m", label: "Вход с середины треугольника CHOCK на 1 мин" },
  { id: "break_2vwap_then_ema100", label: "Цена сначала пробила 2×VWAP, а потом EMA 100" },
  { id: "min1_trade_line_ema100", label: "Линия тренда на 1мин пробила ЕМА100" },
  { id: "min5_trade_line_ema100", label: "Линия тренда на 5мин пробила ЕМА100" },
  { id: "min10_trade_line_ema100", label: "Линия тренда на 10мин пробила ЕМА100" },
  { id: "min15_trade_line_ema100", label: "Линия тренда на 15мин пробила ЕМА100" },
  






  // Два "условия" направления — НЕ показываем в списке чекбоксов,
  // но экспортируем для фильтров/аналитики.
  { id: "dir_long",  label: "Вход: ЛОНГ" },
  { id: "dir_short", label: "Вход: ШОРТ" },
];

const HIDE_IN_LIST = new Set(["dir_long", "dir_short"]);

export default function Conditions({ onSave }) {
  const [open, setOpen] = useState(true);

  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mes-calc-conditions")) || {}; }
    catch { return {}; }
  });

  // Направление: "", "dir_long" или "dir_short"
  const [direction, setDirection] = useState(() => {
    try { return localStorage.getItem("mes-calc-direction") || ""; }
    catch { return ""; }
  });

  const [isProfit, setIsProfit] = useState(true);

  useEffect(() => {
    localStorage.setItem("mes-calc-conditions", JSON.stringify(checked));
  }, [checked]);

  useEffect(() => {
    if (direction) localStorage.setItem("mes-calc-direction", direction);
  }, [direction]);

  const visibleList = useMemo(
    () => CONDITIONS.filter(c => !HIDE_IN_LIST.has(c.id)),
    []
  );

  // считаем «отмечено»: чекбоксы + (направление, если выбрано)
  const count = useMemo(() => {
    const base = Object.values(checked).filter(Boolean).length;
    return base + (direction ? 1 : 0);
  }, [checked, direction]);

  const toggle = (id) => setChecked((p) => ({ ...p, [id]: !p[id] }));
  const clearAll = () => {
    setChecked({});
    setDirection("");
    localStorage.removeItem("mes-calc-direction");
  };

  const handleSave = () => {
    if (!direction) return; // «Сохранить» будет disabled, но на всякий случай.
    const ids = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([k]) => k);

    // добавляем направление как отдельное условие
    ids.push(direction);

    onSave?.(ids, isProfit);
  };

  return (
    <aside className={`${styles.panel} ${open ? styles.open : styles.closed}`}>

      {/* Пилюля-тогглер показываем ТОЛЬКО в закрытом состоянии — выглядит как раньше */}
      {!open && (
        <button className={styles.toggle} onClick={() => setOpen(true)}>
          {"☑"} <span className={styles.toggleTxt}>Чек-лист</span>
          {count > 0 && <span className={styles.badge}>{count}</span>}
        </button>
      )}

      {open && (
        <div className={styles.content}>
          <div className={styles.headerRow}>
            {/* Крестик закрытия внутри шапки */}
            <button
              className={styles.closeX}
              onClick={() => setOpen(false)}
              aria-label="Закрыть панель"
              title="Закрыть"
            >
              ×
            </button>

            <h3 className={styles.title}>Условия входа</h3>

            {/* Кнопки направления — справа вверху */}
            <div className={styles.dirWrap} title="Выберите направление сделки">
              <button
                className={`${styles.dirBtn} ${styles.dirLong} ${direction === "dir_long" ? styles.on : ""}`}
                onClick={() => setDirection(direction === "dir_long" ? "" : "dir_long")}
                aria-pressed={direction === "dir_long"}
                aria-label="ЛОНГ"
              >
                <span className={styles.arrowUp} />
              </button>
              <button
                className={`${styles.dirBtn} ${styles.dirShort} ${direction === "dir_short" ? styles.on : ""}`}
                onClick={() => setDirection(direction === "dir_short" ? "" : "dir_short")}
                aria-pressed={direction === "dir_short"}
                aria-label="ШОРТ"
              >
                <span className={styles.arrowDown} />
              </button>
            </div>

            <div className={styles.counter}>{count} отмечено</div>
          </div>

          <div className={styles.list}>
            {visibleList.map((c) => (
              <label key={c.id} className={styles.item}>
                <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)} />
                <span className={styles.check} aria-hidden />
                <span className={styles.label}>{c.label}</span>
              </label>
            ))}
          </div>

          <div className={styles.actions}>
            <label className={styles.resultToggle}>
              <input
                type="checkbox"
                checked={isProfit}
                onChange={(e) => setIsProfit(e.target.checked)}
              />
              <span className={styles.switch} />
              <span className={styles.resultTxt}>
                {isProfit ? "Сделка прибыльная" : "Сделка убыточная"}
              </span>
            </label>

            <div className={styles.spacer} />

            <button className={styles.btnGhost} onClick={clearAll}>Сбросить</button>
            <button
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={!direction}   // без направления сохранять нельзя
              title={!direction ? "Выберите ЛОНГ или ШОРТ" : "Сохранить"}
            >
              Сохранить
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
