import React from "react";
import styles from "./ModalBase.module.css";

export default function ModalBase({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
        <header className={styles.header}>
          <h3>{title}</h3>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть">✕</button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
