import React from "react";
import Stat from "../Stat";
import styles from "./styles.module.css";

export default function PositionStats({ computed }) {
  const fmtMoney = (n) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat("ru-RU", { style:"currency", currency:"USD", maximumFractionDigits:2 }).format(n)
      : "—";
  const fmtNum = (n) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits:2 }).format(n)
      : "—";

  return (
    <div className={styles.statsGrid}>
      <Stat label="Риск на 1 контракт" value={fmtMoney(computed.perContractRisk)} />
      <Stat label="Профит на 1 контракт (по ТП)" value={fmtMoney(computed.perContractProfit)} />
      <Stat label="Контрактов к взятию" value={computed.valid ? String(computed.contracts) : "—"} />
      <Stat label="Суммарный риск" value={fmtMoney(computed.totalRisk)} />
      <Stat label="Ожидаемый профит (по ТП)" value={fmtMoney(computed.totalProfit)} />
      <Stat label="Risk : Reward" value={Number.isFinite(computed.rr) ? `${fmtNum(computed.rr)} : 1` : "—"} />
    </div>
  );
}
