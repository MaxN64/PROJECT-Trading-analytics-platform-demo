import React from "react";
import NumberField from "../NumberField";
import Stat from "../Stat";
import styles from "./styles.module.css";

export default function DayRiskControls({ dayRiskLimit, onChangeDayLimit, dayRisk }) {
  const fmtMoney = (n) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat("ru-RU", { style:"currency", currency:"USD", maximumFractionDigits:2 }).format(n)
      : "—";

  return (
    <div className={styles.riskBlock}>
      <div className={styles.riskInputs}>
        <NumberField
          label="Дневной лимит потерь"
          value={dayRiskLimit}
          onChange={onChangeDayLimit}
          hint="Напр.: 600 $"
        />
        <div className={styles.riskStats}>
          <Stat label="Сделок сегодня" value={String(dayRisk.count)} />
          <Stat label="Потеряно сегодня" value={fmtMoney(dayRisk.used)} />
          <Stat label="Осталось на день" value={fmtMoney(dayRisk.left)} />
        </div>
      </div>

      {dayRisk?.stop && (
        <div className={styles.noteWarn}>
          Достигнут дневной лимит. Дисциплина спасает от разорения.
        </div>
      )}
    </div>
  );
}
