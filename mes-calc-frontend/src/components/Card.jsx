import React from "react";
import styles from "./Card.module.css";

export default function Card({ title, children, className }) {
  return (
    <section className={`${styles.card} ${className || ""}`}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {/* оборачиваем контент, чтобы можно было прокручивать при фиксированной высоте */}
      <div className={styles.body}>
        {children}
      </div>
    </section>
  );
}
