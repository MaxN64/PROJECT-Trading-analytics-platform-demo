// src/pages/AiPlanPage.jsx
import React, { useMemo, useState } from "react";
import styles from "./AiPlanPage.module.css";

/* ===== Время Нью-Йорка ===== */
function nowNY() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}
function fmtNY(d = nowNY()) {
  const dd = d.toLocaleString("ru-RU", {
    timeZone: "America/New_York",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dd} (NY)`;
}

/* ===== Шаблон промта ===== */
function buildDefaultPrompt() {
  const when = fmtNY();
  return (
`Ты — продвинутый ассистент-трейдер по ES (S&P 500 фьючерс).
Время запроса: ${when}.

Дай краткий торговый план:
1) Сценарии на ближайшие 2 часа (ключевые уровни, вероятные направления, контекст).
2) План до конца текущей RTH-сессии (NY 9:30–16:00):
   - важные зоны ликвидности (поддержка/сопротивление),
   - триггеры входа/выхода,
   - риски, отмена сценариев,
   - поведение вблизи VWAP/EMA (1m/5m/15m).
3) Укажи конкретные числа уровней (±2–3 пункта ок), не расписывай очевидности.
4) Итог: чек-лист из 5–8 пунктов, максимально практично.

Формат ответа:
- Заголовок для «2 часа», буллеты 5–10.
- Заголовок для «До конца сессии», буллеты 6–12.
- Короткий чек-лист.

Не используй лишнюю воду, будь конкретным.`);
}

/* Можно переключать домен при желании */
const CHAT_DOMAINS = [
  { value: "https://chat.openai.com/", label: "chat.openai.com" },
  { value: "https://chatgpt.com/", label: "chatgpt.com" },
];

export default function AiPlanPage() {
  const initial = useMemo(buildDefaultPrompt, []);
  const [text, setText] = useState(initial);
  const [info, setInfo] = useState("");
  const [chatDomainUrl, setChatDomainUrl] = useState(CHAT_DOMAINS[0].value);

  const showInfo = (msg, ms = 1400) => {
    setInfo(msg);
    window.clearTimeout(showInfo._t);
    showInfo._t = window.setTimeout(() => setInfo(""), ms);
  };

  const refreshTime = () => {
    setText(buildDefaultPrompt());
    showInfo("Время обновлено.");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showInfo("Промт скопирован в буфер обмена.");
    } catch {
      showInfo("Не удалось скопировать. Скопируйте вручную.", 1800);
    }
  };

  // КРИТИЧЕСКИЙ МОМЕНТ: сначала открываем about:blank, потом навигируем вкладку.
  // Это надёжно удерживает новый контекст именно вкладкой, даже если у тебя
  // установлен PWA ChatGPT.
  const openInNewTab = (url) => {
    const w = window.open("about:blank", "_blank"); // без features!
    if (!w) {
      showInfo("Браузер заблокировал всплывающее окно. Разреши всплывающие.", 2500);
      return;
    }
    try {
      // необязательно, просто приятный лоадер
      w.document.write("<!doctype html><title>Opening ChatGPT…</title>");
    } catch {}
    w.location.href = url;
  };

  const openChat = () => openInNewTab(chatDomainUrl);

  const copyAndOpen = async () => {
    await copy();
    openChat();
  };

  const saveLocal = () => {
    try {
      localStorage.setItem("ai_plan_prompt", text);
      showInfo("Сохранено локально.");
    } catch {
      showInfo("Не удалось сохранить.", 1800);
    }
  };

  const loadLocal = () => {
    try {
      const v = localStorage.getItem("ai_plan_prompt");
      if (v) {
        setText(v);
        showInfo("Загружено из локального хранилища.");
      } else {
        showInfo("Ничего не найдено.", 1200);
      }
    } catch {
      showInfo("Не удалось загрузить.", 1800);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>ES — AI план</h1>

        <div className={styles.domainPicker}>
          <label className={styles.domainLabel}>Открывать в:</label>
          <select
            className={styles.domainSelect}
            value={chatDomainUrl}
            onChange={(e) => setChatDomainUrl(e.target.value)}
          >
            {CHAT_DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={refreshTime} title="Обновить время в промте">
          Обновить время (NY)
        </button>

        <div className={styles.sep} />

        <button className={styles.btnPrimary} onClick={copy}>
          Скопировать
        </button>
        <button className={styles.btn} onClick={openChat}>
          Открыть ChatGPT
        </button>
        <button className={styles.btnAccent} onClick={copyAndOpen}>
          Скопировать и открыть
        </button>

        <div className={styles.sep} />

        <button className={styles.btnGhost} onClick={saveLocal}>Сохранить</button>
        <button className={styles.btnGhost} onClick={loadLocal}>Загрузить</button>
      </div>

      {info && <div className={styles.info}>{info}</div>}

      <textarea
        className={styles.editor}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />

      <p className={styles.note}>
        Подсказка: нажми «Скопировать и открыть» → в новой вкладке ChatGPT просто вставь промт (<kbd>Ctrl</kbd>+<kbd>V</kbd>) и отправь.
      </p>
    </div>
  );
}
