import React, { useEffect, useRef } from "react";
import s from "./TvDualPage.module.css";

/**
 * ВАЖНО:
 * - Встроенные виджеты НЕ умеют подхватывать ваши личные layout'ы и приватные индикаторы.
 * - Кнопки "Open my layout" открывают ваш настоящий layout в новой вкладке.
 */
export default function TvDualPage() {
  // символы для виджетов (меняйте под себя)
  const topSymbol = "CME_MINI:ES1!";
  const bottomSymbol = "CME_MINI:NQ1!";

  // ваши layout'ы (как в вашей ссылке)
  const topLayoutUrl = "https://www.tradingview.com/chart/ukiQlvuF/?symbol=CME_MINI%3AES1%21";
  const bottomLayoutUrl = "https://www.tradingview.com/chart/ukiQlvuF/?symbol=CME_MINI%3ANQ1%21";

  const topRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const init = () => {
      // очищаем контейнеры перед инициализацией (если перезаходим на страницу)
      if (topRef.current) topRef.current.innerHTML = "";
      if (bottomRef.current) bottomRef.current.innerHTML = "";

      // TOP
      /* global TradingView */
      if (window.TradingView) {
        new window.TradingView.widget({
          autosize: true,
          container_id: topRef.current,
          symbol: topSymbol,
          interval: "5",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "rgba(0,0,0,0)",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          allow_symbol_change: true,
          studies: [
            // тут только публичные/встроенные индикаторы, например:
            // "MACD@tv-basicstudies", "RSI@tv-basicstudies"
          ],
        });

        // BOTTOM
        new window.TradingView.widget({
          autosize: true,
          container_id: bottomRef.current,
          symbol: bottomSymbol,
          interval: "5",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "rgba(0,0,0,0)",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          allow_symbol_change: true,
          studies: [],
        });
      }
    };

    if (!window.TradingView) {
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = init;
      document.body.appendChild(script);
      return () => {
        // удалять скрипт не обязательно; виджеты сами удалятся при размонтировании
      };
    } else {
      init();
    }
  }, [topSymbol, bottomSymbol]);

  return (
    <div className={s.page}>
      <header className={s.bar}>
        <div className={s.left}>
          <h2 className={s.title}>Dual TradingView</h2>
          <p className={s.note}>
            Встроены официальные виджеты (без приватных индикаторов). Ваши layout’ы открываются отдельно.
          </p>
        </div>
        <div className={s.actions}>
          <a className={s.btn} href={topLayoutUrl} target="_blank" rel="noopener noreferrer">
            Open my layout (top) ↗
          </a>
          <a className={s.btnRed} href={bottomLayoutUrl} target="_blank" rel="noopener noreferrer">
            Open my layout (bottom) ↗
          </a>
        </div>
      </header>

      <main className={s.split}>
        <section className={s.half}>
          <div ref={topRef} className={s.tv} />
        </section>
        <section className={s.half}>
          <div ref={bottomRef} className={s.tv} />
        </section>
      </main>
    </div>
  );
}
