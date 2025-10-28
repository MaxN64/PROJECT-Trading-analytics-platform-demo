import React from "react";
import styles from "./Stat.module.css";

export default function Stat({ label, value }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
    </div>
  );
}
