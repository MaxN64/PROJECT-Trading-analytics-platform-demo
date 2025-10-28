import React from "react";
import Card from "./Card";
import Stat from "./Stat";

export default function CurrentValuesCard({
  contractLabel, pricePerPoint, maxLoss, stopPoints, tpPoints
}) {
  const fmtMoney = (n) =>
    new Intl.NumberFormat("ru-RU", { style:"currency", currency:"USD", maximumFractionDigits:2 })
      .format(Number(String(n).replace(",", ".")) || 0);

  const fmtNum = (n) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 })
      .format(Number(String(n).replace(",", ".")) || 0);

  return (
    <Card title="Текущие значения">
      <div style={{display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fit, minmax(180px,1fr))"}}>
        <Stat label="Контракт" value={contractLabel} />
        <Stat label="Цена 1 пункта / контракт" value={fmtMoney(pricePerPoint)} />
        <Stat label="Макс. убыток на сделку" value={fmtMoney(maxLoss)} />
        <Stat label="Стоп-лосс (введено)" value={`${fmtNum(stopPoints)} п.`} />
        <Stat label="Тейк-профит (введено)" value={`${fmtNum(tpPoints)} п.`} />
      </div>
    </Card>
  );
}
