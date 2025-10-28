import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./InvestingCalendarWidget.module.css";

/**
 * Как пользоваться:
 * 1) На странице Investing "Wirtschaftskalender Widget" (или Economic Calendar Widget)
 *    сгенерируй embed-код (они дают <div> + <script>...).
 * 2) Скопируй целиком выдачу (всё, что они предлагают вставить на сайт).
 * 3) Вставь в поле ниже и нажми "Сохранить".
 * 4) Мы отрисуем код внутри <iframe srcdoc="...">, чтобы скрипты выполнились корректно.
 */

const LS_WIDGET = "investing-widget-embed";

export default function InvestingCalendarWidget() {
  const [open, setOpen] = useState(false);
  const [embed, setEmbed] = useState(() => {
    try { return localStorage.getItem(LS_WIDGET) || ""; } catch { return ""; }
  });
  const [temp, setTemp] = useState(embed);

  useEffect(() => {
    try { localStorage.setItem(LS_WIDGET, embed); } catch {}
  }, [embed]);

  // содержимое iframe (srcdoc). Добавим минимальные стили-обёртку.
  const srcdoc = useMemo(() => {
    if (!embed.trim()) return "";
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  html,body{margin:0;padding:0;background:transparent}
  /* иногда помогает убрать лишние полосы прокрутки */
  *{box-sizing:border-box}
</style>
</head>
<body>
  ${embed}
</body>
</html>`;
  }, [embed]);

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>Investing — экономический календарь</h3>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => setOpen(true)}>Настроить</button>
          <a
            className={styles.btnGhost}
            href="https://www.investing.com/tools/economic-calendar/"
            target="_blank" rel="noreferrer"
            title="Открыть календарь на investing.com"
          >
            Открыть в новой вкладке
          </a>
        </div>
      </div>

      {!embed ? (
        <div className={styles.empty}>
          Виджет ещё не подключён. Нажми «Настроить», вставь embed-код с Investing
          и сохрани.
        </div>
      ) : (
        <div className={styles.iframeBox}>
          {/* sandbox можно смягчить, если виджету нужны доп. разрешения */}
          <iframe
            title="Investing Calendar"
            className={styles.iframe}
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      )}

      {open && (
        <div className={styles.modal} onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className={styles.modalInner} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <strong>Подключение виджета Investing</strong>
              <button className={styles.close} onClick={() => setOpen(false)}>✕</button>
            </div>

            <ol className={styles.helpList}>
              <li>Зайди на страницу виджета Investing (Economic/Wirtschafts&nbsp;Calendar&nbsp;Widget).</li>
              <li>Настрой внешний вид, таймзону и колонки → сгенерируй embed-код.</li>
              <li>Скопируй весь блок с <code>&lt;div&gt;</code> и <code>&lt;script&gt;</code>.</li>
              <li>Вставь сюда и нажми «Сохранить».</li>
            </ol>

            <textarea
              className={styles.ta}
              rows={10}
              placeholder="Вставь сюда embed-код виджета Investing…"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
            />

            <div className={styles.modalActions}>
              <button className={styles.btn} onClick={() => { setEmbed(temp); setOpen(false); }}>
                Сохранить
              </button>
              <button className={styles.btnGhost} onClick={() => setTemp(embed)}>
                Сбросить изменения
              </button>
              {!!embed && (
                <button className={styles.danger} onClick={() => { setEmbed(""); setTemp(""); }}>
                  Удалить виджет
                </button>
              )}
            </div>

            <div className={styles.note}>
              Примечание: мы рендерим код внутри изолированного iframe через <code>srcdoc</code>,
              чтобы скрипты корректно исполнялись и не мешали приложению. Если сайт применяет
              жёсткий CSP, некоторые функции виджета могут быть ограничены.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
