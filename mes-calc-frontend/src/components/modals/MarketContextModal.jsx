import React, { useState } from "react";
import ModalBase from "./ModalBase";
import styles from "./MarketContextModal.module.css";

export default function MarketContextModal({ open, onClose, trade, onSave }) {
  const [form, setForm] = useState(() => ({
    session: trade?.session || "RTH",
    hourBlock: trade?.hourBlock || "",
    atr14: trade?.atr14 ?? null,
    atrPercentile: trade?.atrPercentile ?? null,
    gapPct: trade?.gapPct ?? null,
    ibRange: trade?.ibRange ?? null,
    ibExtPct: trade?.ibExtPct ?? null,
    dayType: trade?.dayType || "unknown",
    vwapDistance: trade?.vwapDistance ?? null,
    cumDeltaAtEntry: trade?.cumDeltaAtEntry ?? null,
  }));
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    await onSave({
      session: form.session,
      hourBlock: form.hourBlock,
      atr14: Number(form.atr14),
      atrPercentile: Number(form.atrPercentile),
      gapPct: Number(form.gapPct),
      ibRange: Number(form.ibRange),
      ibExtPct: Number(form.ibExtPct),
      dayType: form.dayType,
      vwapDistance: Number(form.vwapDistance),
      cumDeltaAtEntry: Number(form.cumDeltaAtEntry),
    });
    onClose?.();
  };

  return (
    <ModalBase open={open} onClose={onClose} title={`Контекст рынка #${trade?.index ?? ""}`}
      footer={
        <>
          <button className={styles.btn} onClick={onClose}>Отмена</button>
          <button className={`${styles.btn} ${styles.primary}`} onClick={save}>Сохранить</button>
        </>
      }
    >
      <div className={styles.grid}>
        <Field label="Сессия">
          <select value={form.session} onChange={e=>set("session", e.target.value)}>
            <option value="RTH">RTH</option>
            <option value="ETH">ETH</option>
          </select>
        </Field>
        <Field label="Блок времени (напр. 09:30-10:00)">
          <input value={form.hourBlock} onChange={e=>set("hourBlock", e.target.value)} placeholder="09:30-10:00"/>
        </Field>
        <Field label="ATR(14)">
          <input type="number" step="0.01" value={form.atr14 ?? ""} onChange={e=>set("atr14", Number(e.target.value))}/>
        </Field>
        <Field label="ATR перцентиль (0-100)">
          <input type="number" step="1" value={form.atrPercentile ?? ""} onChange={e=>set("atrPercentile", Number(e.target.value))}/>
        </Field>
        <Field label="Gap %">
          <input type="number" step="0.01" value={form.gapPct ?? ""} onChange={e=>set("gapPct", Number(e.target.value))}/>
        </Field>
        <Field label="IB Range">
          <input type="number" step="0.25" value={form.ibRange ?? ""} onChange={e=>set("ibRange", Number(e.target.value))}/>
        </Field>
        <Field label="IB Extension %">
          <input type="number" step="0.1" value={form.ibExtPct ?? ""} onChange={e=>set("ibExtPct", Number(e.target.value))}/>
        </Field>
        <Field label="Тип дня">
          <select value={form.dayType} onChange={e=>set("dayType", e.target.value)}>
            <option value="trend">trend</option>
            <option value="neutral">neutral</option>
            <option value="nv">non-trend</option>
            <option value="unknown">unknown</option>
          </select>
        </Field>
        <Field label="VWAP distance">
          <input type="number" step="0.25" value={form.vwapDistance ?? ""} onChange={e=>set("vwapDistance", Number(e.target.value))}/>
        </Field>
        <Field label="CumDelta @ entry">
          <input type="number" step="1" value={form.cumDeltaAtEntry ?? ""} onChange={e=>set("cumDeltaAtEntry", Number(e.target.value))}/>
        </Field>
      </div>
    </ModalBase>
  );
}

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}
