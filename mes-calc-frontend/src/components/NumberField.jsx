import React from "react";
import styles from "./NumberField.module.css";

export default function NumberField({ label, value, onChange, hint, placeholder }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
