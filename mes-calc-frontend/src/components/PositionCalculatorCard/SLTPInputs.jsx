import React from "react";
import NumberField from "../NumberField";
import styles from "./styles.module.css";

export default function SLTPInputs({ stopPoints, onChangeStop, tpPoints, onChangeTP }) {
  return (
    <div className={styles.formGrid}>
      <NumberField
        label="Стоп-лосс, пунктов"
        placeholder="например, 35"
        value={stopPoints}
        onChange={onChangeStop}
      />
      <NumberField
        label="Тейк-профит, пунктов"
        placeholder="например, 70"
        value={tpPoints}
        onChange={onChangeTP}
      />
    </div>
  );
}
