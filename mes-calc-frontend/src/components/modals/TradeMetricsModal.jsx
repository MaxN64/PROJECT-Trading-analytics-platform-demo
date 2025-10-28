import React, { useMemo, useState } from "react";
import ModalBase from "./ModalBase";
import styles from "./TradeMetricsModal.module.css";
import { realizedR, maeMfeR, riskPerContract$ } from "../../lib/metrics";

export default function TradeMetricsModal({ open, onClose, trade, onSave }) {
  const [form, setForm] = useState(() => ({
    instrument: trade?.instrument || "ES",
    tickSize: trade?.tickSize ?? 0.25,
    tickValue: trade?.tickValue ?? 12.5,
    qty: trade?.qty ?? trade?.contracts ?? 1,
    entryPrice: trade?.entryPrice ?? null,
    exitPrice: trade?.exitPrice ?? null,
    plannedStop: trade?.plannedStop ?? null,
    plannedTarget: trade?.plannedTarget ?? null,
    lowBeforeExit: trade?.lowBeforeExit ?? null,
    highBeforeExit: trade?.highBeforeExit ?? null,
    isLong: trade?.isLong ?? true,
    fees$: trade?.fees$ ?? 0,
    timeInSec: trade?.timeInSec ?? null,
    slippageTicks: trade?.slippageTicks ?? 0,
  }));

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const rNow = useMemo(() => {
    const r = realizedR(
      Number(form.entryPrice),
      Number(form.exitPrice),
      Number(form.plannedStop),
      Number(form.tickSize),
      Number(form.tickValue),
      Number(form.qty)
    );
    const mm = maeMfeR(
      Number(form.entryPrice),
      Number(form.lowBeforeExit),
      Number(form.highBeforeExit),
      Number(form.plannedStop),
      !!form.isLong,
      Number(form.tickSize),
      Number(form.tickValue)
    );
    const risk$ = riskPerContract$(Number(form.entryPrice), Number(form.plannedStop), Number(form.tickSize), Number(form.tickValue));
    return { r, ...mm, risk$ };
  }, [form]);

  const save = async () => {
    // считаем netR (на будущее для агрегатов)
    const netR = Number.isFinite(rNow.r) ? rNow.r : 0;
    await onSave({
      instrument: form.instrument,
      tickSize: Number(form.tickSize),
      tickValue: Number(form.tickValue),
      qty: Number(form.qty),
      entryPrice: Number(form.entryPrice),
      exitPrice: Number(form.exitPrice),
      plannedStop: Number(form.plannedStop),
      plannedTarget: Number(form.plannedTarget),
      lowBeforeExit: Number(form.lowBeforeExit),
      highBeforeExit: Number(form.highBeforeExit),
      isLong: !!form.isLong,
      fees$: Number(form.fees$),
      timeInSec: Number(form.timeInSec),
      slippageTicks: Number(form.slippageTicks),
      maeR: Number.isFinite(rNow.maeR) ? rNow.maeR : 0,
      mfeR: Number.isFinite(rNow.mfeR) ? rNow.mfeR : 0,
      netR,
    });
    onClose?.();
  };

  return (
    <ModalBase open={open} onClose={onClose} title={`Метрики сделки #${trade?.index ?? ""}`}
      footer={
        <>
          <button className={styles.btn} onClick={onClose}>Отмена</button>
          <button className={`${styles.btn} ${styles.primary}`} onClick={save}>Сохранить</button>
        </>
      }
    >
      <div className={styles.grid}>
        <Field label="Инструмент">
          <select value={form.instrument} onChange={e=>set("instrument", e.target.value)}>
            <option value="ES">ES</option>
            <option value="MES">MES</option>
          </select>
        </Field>

        <Field label="Tick size">
          <input type="number" step="0.01" value={form.tickSize} onChange={e=>set("tickSize", Number(e.target.value))}/>
        </Field>
        <Field label="Tick value ($)">
          <input type="number" step="0.01" value={form.tickValue} onChange={e=>set("tickValue", Number(e.target.value))}/>
        </Field>
        <Field label="Qty">
          <input type="number" step="1" value={form.qty} onChange={e=>set("qty", Number(e.target.value))}/>
        </Field>

        <Field label="Long?">
          <input type="checkbox" checked={form.isLong} onChange={e=>set("isLong", e.target.checked)}/>
        </Field>

        <Field label="Entry">
          <input type="number" step="0.25" value={form.entryPrice ?? ""} onChange={e=>set("entryPrice", Number(e.target.value))}/>
        </Field>
        <Field label="Exit">
          <input type="number" step="0.25" value={form.exitPrice ?? ""} onChange={e=>set("exitPrice", Number(e.target.value))}/>
        </Field>
        <Field label="Planned stop">
          <input type="number" step="0.25" value={form.plannedStop ?? ""} onChange={e=>set("plannedStop", Number(e.target.value))}/>
        </Field>
        <Field label="Planned target">
          <input type="number" step="0.25" value={form.plannedTarget ?? ""} onChange={e=>set("plannedTarget", Number(e.target.value))}/>
        </Field>

        <Field label="Low before exit">
          <input type="number" step="0.25" value={form.lowBeforeExit ?? ""} onChange={e=>set("lowBeforeExit", Number(e.target.value))}/>
        </Field>
        <Field label="High before exit">
          <input type="number" step="0.25" value={form.highBeforeExit ?? ""} onChange={e=>set("highBeforeExit", Number(e.target.value))}/>
        </Field>

        <Field label="Fees ($)">
          <input type="number" step="0.01" value={form.fees$} onChange={e=>set("fees$", Number(e.target.value))}/>
        </Field>
        <Field label="Slippage (ticks)">
          <input type="number" step="1" value={form.slippageTicks} onChange={e=>set("slippageTicks", Number(e.target.value))}/>
        </Field>
        <Field label="Time in trade (sec)">
          <input type="number" step="1" value={form.timeInSec ?? ""} onChange={e=>set("timeInSec", Number(e.target.value))}/>
        </Field>
      </div>

      <div className={styles.preview}>
        <div className={styles.stat}><span>Risk/contract, $:</span><b>{rNow.risk$?.toFixed(2) ?? "-"}</b></div>
        <div className={styles.stat}><span>Realized R:</span><b>{Number.isFinite(rNow.r) ? rNow.r.toFixed(2) : "-"}</b></div>
        <div className={styles.stat}><span>MAE (R):</span><b>{Number.isFinite(rNow.maeR) ? rNow.maeR.toFixed(2) : "-"}</b></div>
        <div className={styles.stat}><span>MFE (R):</span><b>{Number.isFinite(rNow.mfeR) ? rNow.mfeR.toFixed(2) : "-"}</b></div>
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
