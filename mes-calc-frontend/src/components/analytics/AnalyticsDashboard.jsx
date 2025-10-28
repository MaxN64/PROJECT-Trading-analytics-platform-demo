import React from "react";
import styles from "./AnalyticsDashboard.module.css";
import KpiCards from "./KpiCards";
import HourHeatmap from "./HourHeatmap";

/** Передай сюда массив trades (лучше отфильтрованный), где у сделок есть:
 * - localHour (0..23)
 * - netR (число, сохраняется из модалки метрик)
 */
export default function AnalyticsDashboard({ trades = [] }) {
  return (
    <div className={styles.wrap}>
      <KpiCards trades={trades} />
      <HourHeatmap trades={trades} />
    </div>
  );
}
