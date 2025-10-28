import React, { useEffect, useMemo, useState } from "react";
import styles from "./TradesTable.module.css";

const LS_KEY = "trades-table-open";

export default function TradesTable({ trades, onToggleProfit, onDelete }) {
  // восстанавливаем предыдущее состояние (по умолчанию открыта)
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      return v === null ? true : v === "1";
    } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, isOpen ? "1" : "0"); } catch {}
  }, [isOpen]);

  const rows = useMemo(
    () => [...trades].sort((a, b) => b.createdAt - a.createdAt),
    [trades]
  );

  const openFullPage = () => {
    const url = `${window.location.origin}${window.location.pathname}#/trades`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Свернутый вид — компактная «пилюля», как у правой панели
  if (!isOpen) {
    return (
      <button
        className={styles.collapsed}
        onClick={() => setIsOpen(true)}
        title="Показать таблицу сделок"
        aria-label="Показать таблицу сделок"
      >
        <span className={styles.collapsedIcon}></span>
        <span className={styles.collapsedText}>Сделки</span>
        <span className={styles.collapsedBadge}>{rows.length}</span>
      </button>
    );
  }

  // Открытый вид — сама таблица
  return (
    <aside className={styles.wrap} aria-label="Краткая таблица сделок">
      <div className={styles.header}>
        <h3 className={styles.title}>Таблица сделок</h3>
        <div className={styles.actions}>
          <button
            className={styles.expandBtn}
            onClick={openFullPage}
            title="Открыть в новой вкладке"
            aria-label="Открыть в новой вкладке"
          >
            [ ]
          </button>
          <div className={styles.count}>{rows.length}</div>
          <button
            className={styles.closeBtn}
            onClick={() => setIsOpen(false)}
            title="Свернуть"
            aria-label="Свернуть"
          >
            ✕
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>Пока нет сохранённых сделок.</div>
      ) : (
        <div className={styles.table} role="table" aria-label="Сделки (кратко)">
          <div className={`${styles.tr} ${styles.th}`} role="row">
            <div className={styles.td}>#</div>
            <div className={styles.td}>Время</div>
            <div className={styles.td}>SL (п.)</div>
            <div className={styles.td}>Контрактов</div>
            <div className={styles.td}>Прибыль/Убыток</div>
          </div>

          {rows.map((t) => (
            <div key={t.id} className={styles.tr} role="row">
              <div className={styles.td}>{t.index}</div>
              <div className={styles.td}>{formatDate(t.createdAt)}</div>
              <div className={styles.td}>{t.stopPoints}</div>
              <div className={styles.td}>{t.contracts}</div>
              <div className={styles.td}>
                <label className={styles.profitBox} title="Отметить результат">
                  <input
                    type="checkbox"
                    checked={!!t.isProfit}
                    onChange={() => onToggleProfit(t.id)}
                  />
                  <span className={styles.chk} />
                  <span className={t.isProfit ? styles.profit : styles.loss}>
                    {t.isProfit ? "прибыль" : "убыток"}
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
