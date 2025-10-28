import React from "react";
import s from "./TradingViewOpenButton.module.css";

/**
 * Кнопка открытия вашего TradingView layout в новом табе.
 * По умолчанию открывает: https://www.tradingview.com/chart/ukiQlvuF/?symbol=CME_MINI%3AES1%21
 *
 * Можно передать другой символ через prop `symbol`, например "CME_MINI:ES1!".
 */
export default function TradingViewOpenButton({
  label = "Open my TradingView chart",
  layoutId = "ukiQlvuF",                 // ваш layout id из ссылки
  symbol,                                 // например "CME_MINI:ES1!"
  href,                                   // если хотите полностью свой URL — задайте href
}) {
  const defaultUrl = `https://www.tradingview.com/chart/${layoutId}/?symbol=CME_MINI%3AES1%21`;
  const url =
    href ||
    (symbol
      ? `https://www.tradingview.com/chart/${layoutId}/?symbol=${encodeURIComponent(
          symbol
        )}`
      : defaultUrl);

  return (
    <a
      className={s.btn}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Откроется в новой вкладке"
    >
      <svg className={s.icon} viewBox="0 0 24 24" aria-hidden>
        <path d="M14 3h7v7h-2V6.41l-8.29 8.3-1.42-1.42 8.3-8.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"/>
      </svg>
      {label}
      <span className={s.arrow}>↗</span>
    </a>
  );
}
