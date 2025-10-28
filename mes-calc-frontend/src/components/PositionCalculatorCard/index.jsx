import React from "react";
import Card from "../Card";
import SLTPInputs from "./SLTPInputs";
import PositionStats from "./PositionStats";
import DayRiskControls from "./DayRiskControls";
import styles from "./styles.module.css";

export default function PositionCalculatorCard({
  stopPoints, onChangeStop,
  tpPoints, onChangeTP,
  computed,
  dayRisk, dayRiskLimit, onChangeDayLimit
}) {
  return (
    <Card title="Расчёт по стоп-лоссу">
      {dayRisk?.stop && (
        <div className={styles.stopBanner}>
          🚫 Дневной лимит потерь достигнут. <strong>STOP TRADING</strong>.
        </div>
      )}

      <SLTPInputs
        stopPoints={stopPoints}
        onChangeStop={onChangeStop}
        tpPoints={tpPoints}
        onChangeTP={onChangeTP}
      />

      <PositionStats computed={computed} />

      <DayRiskControls
        dayRiskLimit={dayRiskLimit}
        onChangeDayLimit={onChangeDayLimit}
        dayRisk={dayRisk}
      />
    </Card>
  );
}
