import React from "react";
import styles from "./RiskLimitBar.module.css";

/**
 * props:
 *  dayRiskLimitR, weekRiskLimitR (числа, обычно отрицательные)
 *  dayRealizedR, weekRealizedR (фактический результат в R)
 */
export default function RiskLimitBar({
  dayRiskLimitR = -3,
  weekRiskLimitR = -10,
  dayRealizedR = 0,
  weekRealizedR = 0,
}) {
  const pct = (val, lim) =>
    Math.max(0, Math.min(100, (Math.abs(val) / Math.abs(lim || 1)) * 100));

  return (
    <div className={styles.wrap}>
      <Bar
        label="Дневной риск"
        valueR={dayRealizedR}
        limitR={dayRiskLimitR}
        pct={pct(dayRealizedR, dayRiskLimitR)}
      />
      <Bar
        label="Недельный риск"
        valueR={weekRealizedR}
        limitR={weekRiskLimitR}
        pct={pct(weekRealizedR, weekRiskLimitR)}
      />
    </div>
  );
}

function Bar({ label, valueR, limitR, pct }) {
  const warn = valueR <= limitR; // лимит достигнут/превышен (лимит отрицательный)
  return (
    <div className={`${styles.bar} ${warn ? styles.warn : ""}`}>
      <div className={styles.head}>
        <span>{label}</span>
        <b>{valueR.toFixed(2)}R</b>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      {warn && <div className={styles.note}>Лимит достигнут — пауза</div>}
    </div>
  );
}
