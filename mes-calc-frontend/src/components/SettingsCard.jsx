import React from "react";
import Card from "./Card";
import NumberField from "./NumberField";
import styles from "./SettingsCard.module.css";

export default function SettingsCard({
  contract, onChangeContract,
  maxLoss, onChangeMaxLoss,
  pricePerPoint, onChangePricePerPoint,
  contractPresets
}) {
  return (
    <Card title="Настройки">
      <div className={styles.formGrid}>
        <label className={styles.selectField}>
          <span>Контракт</span>
          <select value={contract} onChange={(e)=>onChangeContract(e.target.value)} className={styles.select}>
            {Object.entries(contractPresets).map(([key, v])=>(
              <option key={key} value={key}>{v.label}</option>
            ))}
          </select>
        </label>

        <NumberField
          label="Макс. сумма убытка на сделку"
          value={maxLoss}
          onChange={onChangeMaxLoss}
          hint="По умолчанию 300 $ (можно изменить)"
        />
        <NumberField
          label="Цена 1 пункта на контракт"
          value={pricePerPoint}
          onChange={onChangePricePerPoint}
          hint="Меняется при выборе контракта — можно поправить вручную"
        />
      </div>

      <div className={styles.formulaBox}>
        <strong>Формула:</strong> ⌊ Макс. убыток / (Стоп-лосс × Цена пункта) ⌋
      </div>
    </Card>
  );
}
