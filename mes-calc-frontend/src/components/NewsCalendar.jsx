import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./NewsCalendar.module.css";

/**
 * Провайдеры:
 * - "te"  (TradingEconomics API; ключ в .env: VITE_TE_KEY или REACT_APP_TE_KEY)
 * - "csv" (ручной импорт CSV из Investing)
 */

const LS_EVENTS   = "news-events";
const LS_SETTINGS = "news-settings";

const DEFAULT_SETTINGS = {
  provider: "csv",                       // по умолчанию CSV, можно вернуть "te"
  tzCsv: "ET",                           // зона, в которой CSV: "UTC" | "ET" | "LOCAL"
  countries: ["United States"],
  importance: ["high"],
  warnMinutes: [30, 15, 5, 1],
  sound: true,
  vibrate: true,
  mutedIds: [],
  windowDays: 7,                         // для TE
  csvMergeMode: "merge",                 // "merge" | "replace"
};

export default function NewsCalendar() {
  /* ===== settings ===== */
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}) }; }
    catch { return DEFAULT_SETTINGS; }
  });
  useEffect(() => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  /* ===== events ===== */
  const [events, setEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_EVENTS)) || []; }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem(LS_EVENTS, JSON.stringify(events));
  }, [events]);

  /* ===== ui ===== */
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [rawCount, setRawCount] = useState(0);

  /* ===== загрузка TE (если используешь API) ===== */
  const reloadTE = async () => {
    setErr("");
    setLoading(true);
    try {
      const from = todayISO();
      const to   = addDaysISO(new Date(), clampInt(settings.windowDays, 0, 14));
      const { items, url } = await loadTECalendar({
        from, to, countries: settings.countries, debug: true,
      });
      setDebugUrl(url);
      setRawCount(items.length);
      applyFilterAndSet(items);
    } catch (e) {
      setErr(e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  /* ===== автообновление для TE ===== */
  useEffect(() => {
    if (settings.provider === "te") reloadTE();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.provider, settings.windowDays, settings.countries.join(","), settings.importance.join(",")]);

  /* ===== фильтр + установка ===== */
  const applyFilterAndSet = (items) => {
    const wantCountries = new Set(settings.countries);
    const wantImp       = new Set(settings.importance);

    const filtered = items.filter(ev => {
      const c = normalizeCountry(ev.country);
      const countryOk = wantCountries.size === 0 ? true : wantCountries.has(c);
      const impOk     = wantImp.size === 0 ? true : wantImp.has(ev.importance);
      return countryOk && impOk;
    });

    setEvents(dedupById(filtered));
    if (!filtered.length) {
      setErr("Событий не найдено. Расширь горизонт/страны или включи medium/low.");
    }
  };

  /* ===== напоминания ===== */
  const upcoming = useMemo(() => {
    const now = Date.now();
    return events
      .filter(e =>
        e.timeUtc && new Date(e.timeUtc).getTime() > now - 60_000 &&
        settings.importance.includes(e.importance) &&
        (settings.countries.length === 0 || settings.countries.includes(normalizeCountry(e.country))) &&
        !settings.mutedIds.includes(e.id)
      )
      .sort((a, b) => new Date(a.timeUtc) - new Date(b.timeUtc));
  }, [events, settings]);

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const nextAlert = useMemo(() => {
    if (!upcoming.length) return null;
    const now = nowTick;
    for (const ev of upcoming) {
      const t = new Date(ev.timeUtc).getTime();
      const diffMin = Math.round((t - now) / 60000);
      if (diffMin === 0) return { ev, mode: "now",  inMin: diffMin };
      if (settings.warnMinutes.includes(diffMin)) return { ev, mode: "pre",  inMin: diffMin };
      if (diffMin > 0 && diffMin < Math.min(...settings.warnMinutes)) {
        return { ev, mode: "soon", inMin: diffMin };
      }
    }
    return null;
  }, [upcoming, nowTick, settings.warnMinutes]);

  /* звук/вибро */
  const playedRef = useRef(new Set());
  useEffect(() => {
    if (!nextAlert) return;
    const key = `${nextAlert.ev.id}:${nextAlert.inMin}:${nextAlert.mode}`;
    if (playedRef.current.has(key)) return;
    playedRef.current.add(key);
    if (settings.sound)  try { beep(220, nextAlert.mode === "now" ? 300 : 180); } catch {}
    if (settings.vibrate && navigator.vibrate) try { navigator.vibrate(nextAlert.mode === "now" ? 300 : 150); } catch {}
  }, [nextAlert, settings.sound, settings.vibrate]);

  const muteEvent = (id) =>
    setSettings(s => ({ ...s, mutedIds: [...new Set([...(s.mutedIds || []), id])] }));

  /* ===== CSV импорт ===== */
  const fileRef = useRef(null);
  const onPickCsv = () => fileRef.current?.click();
  const onCsv = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text   = await f.text();
      const parsed = parseCSVAuto(text);                // авто-разделитель + кавычки
      const normalized = parsedToEvents(parsed, settings.tzCsv); // нормализация + TZ
      setRawCount(normalized.length);

      let base = events;
      if (settings.csvMergeMode === "replace") base = [];
      const merged = dedupById([...base, ...normalized]);

      setEvents(merged);
      setSettings(s => ({ ...s, provider: "csv" }));   // переключимся на CSV
      setErr("");
    } catch (err) {
      alert("Не удалось прочитать CSV: " + (err?.message || String(err)));
    } finally {
      e.target.value = "";
    }
  };

  const clearAll = () => {
    if (!window.confirm("Удалить все сохранённые события?")) return;
    setEvents([]);
  };

  /* ===== render ===== */
  return (
    <>
      <button className={styles.iconBtn} onClick={() => setOpen(true)} title="Календарь новостей">🔔</button>

      {nextAlert && (
        <div className={`${styles.banner} ${nextAlert.mode === "now" ? styles.bannerNow : styles.bannerWarn}`}>
          <div className={styles.bannerRow}>
            <span className={styles.dot} />
            <span className={styles.bText}>
              {formatLocal(nextAlert.ev.timeUtc)} • {nextAlert.ev.title} ({normalizeCountry(nextAlert.ev.country)})
              {" — "}
              {nextAlert.mode === "now" ? "идёт публикация" : `через ${nextAlert.inMin} мин`}
            </span>
          </div>
          <div className={styles.bannerActions}>
            <button onClick={() => muteEvent(nextAlert.ev.id)}>Игнорировать</button>
            <button onClick={() => setOpen(true)}>Открыть</button>
          </div>
        </div>
      )}

      {open && (
        <div className={styles.modal} onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className={styles.modalInner} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.hLeft}>
                <strong>Календарь новостей</strong>
                <span className={styles.meta}>источник: {settings.provider === "te" ? "TradingEconomics API" : "CSV"}</span>
              </div>
              <div className={styles.hRight}>
                {settings.provider === "te" && (
                  <button className={styles.sec} onClick={reloadTE} disabled={loading}>
                    {loading ? "Обновляю…" : "Обновить"}
                  </button>
                )}
                <button className={styles.close} onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>

            {!!err && <div className={styles.err}>{err}</div>}

            <div className={styles.controls}>
              <label>
                Источник:
                <select
                  value={settings.provider}
                  onChange={(e) => setSettings(s => ({ ...s, provider: e.target.value }))}
                >
                  <option value="csv">CSV (Investing)</option>
                  <option value="te">TradingEconomics API</option>
                </select>
              </label>

              {settings.provider === "te" ? (
                <>
                  <label>
                    Горизонт (дней):
                    <input
                      type="number"
                      min={0} max={14}
                      value={String(settings.windowDays ?? 7)}
                      onChange={(e) => setSettings(s => ({ ...s, windowDays: clampInt(e.target.value, 0, 14) }))}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Таймзона CSV:
                    <select
                      value={settings.tzCsv}
                      onChange={(e) => setSettings(s => ({ ...s, tzCsv: e.target.value }))}
                    >
                      <option value="ET">New York (ET)</option>
                      <option value="UTC">UTC</option>
                      <option value="LOCAL">Локальная</option>
                    </select>
                  </label>

                  <label>
                    Режим импорта:
                    <select
                      value={settings.csvMergeMode}
                      onChange={(e) => setSettings(s => ({ ...s, csvMergeMode: e.target.value }))}
                    >
                      <option value="merge">Слить с текущими</option>
                      <option value="replace">Заменить текущие</option>
                    </select>
                  </label>

                  <div className={styles.csvBlock}>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className={styles.file} onChange={onCsv} />
                    <button className={styles.sec} onClick={onPickCsv}>Загрузить CSV</button>
                    {events.length > 0 && (
                      <button className={styles.danger} onClick={clearAll}>Очистить</button>
                    )}
                  </div>
                </>
              )}

              <fieldset className={styles.inlineGroup}>
                <legend>Важность</legend>
                {["high", "medium", "low"].map(k => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={settings.importance.includes(k)}
                      onChange={() => toggleInList(setSettings, "importance", k)}
                    />
                    {k}
                  </label>
                ))}
              </fieldset>

              <fieldset className={styles.inlineGroup}>
                <legend>Страны</legend>
                {["United States", "Canada", "Euro Area", "United Kingdom"].map(ctry => (
                  <label key={ctry}>
                    <input
                      type="checkbox"
                      checked={settings.countries.includes(ctry)}
                      onChange={() => toggleInList(setSettings, "countries", ctry)}
                    />
                    {ctry}
                  </label>
                ))}
              </fieldset>

              <fieldset className={styles.inlineGroup}>
                <legend>Напоминания (мин)</legend>
                {[30, 15, 10, 5, 1].map(m => (
                  <label key={m}>
                    <input
                      type="checkbox"
                      checked={settings.warnMinutes.includes(m)}
                      onChange={() => toggleInList(setSettings, "warnMinutes", m)}
                    />
                    {m}
                  </label>
                ))}
              </fieldset>

              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={settings.sound}
                  onChange={(e) => setSettings(s => ({ ...s, sound: e.target.checked }))}
                />
                Звук
              </label>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={settings.vibrate}
                  onChange={(e) => setSettings(s => ({ ...s, vibrate: e.target.checked }))}
                />
                Вибро
              </label>
            </div>

            <div className={styles.debugRow}>
              <span>Загружено: {rawCount}</span>
              <span>После фильтра: {events.length}</span>
              {debugUrl && (
                <a className={styles.link} href={debugUrl} target="_blank" rel="noreferrer">Открыть запрос</a>
              )}
            </div>

            <div className={styles.listWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Событие</th>
                    <th>Страна</th>
                    <th>Важность</th>
                    <th>Факт</th>
                    <th>Прогноз</th>
                    <th>Предыдущее</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {events
                    .slice()
                    .sort((a, b) => new Date(a.timeUtc) - new Date(b.timeUtc))
                    .map(ev => (
                      <tr key={ev.id} className={ev.importance === "high" ? styles.rowHigh : ""}>
                        <td>{formatLocal(ev.timeUtc)}</td>
                        <td>{ev.title}</td>
                        <td>{normalizeCountry(ev.country)}</td>
                        <td className={styles.badge + " " + styles["imp_" + ev.importance]}>{ev.importance}</td>
                        <td>{ev.actual ?? "—"}</td>
                        <td>{ev.forecast ?? "—"}</td>
                        <td>{ev.previous ?? "—"}</td>
                        <td className={styles.actionsCell}>
                          {settings.mutedIds.includes(ev.id) ? (
                            <button className={styles.link} onClick={() => unmute(setSettings, ev.id)}>Включить</button>
                          ) : (
                            <button className={styles.link} onClick={() => muteEvent(ev.id)}>Игнор.</button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className={styles.footerRow}>
              <span className={styles.meta}>Всего событий: {events.length}</span>
              <button className={styles.outline} onClick={() => exportJson(events)}>Экспорт JSON</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================= helpers ================= */

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function addDaysISO(d, days) {
  const x = new Date(d); x.setDate(x.getDate() + days);
  return x.toISOString().slice(0, 10);
}
function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
function toggleInList(setSettings, key, value) {
  setSettings(s => {
    const arr = Array.isArray(s[key]) ? s[key] : [];
    const next = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];
    return { ...s, [key]: next };
  });
}
function unmute(setSettings, id) {
  setSettings(s => ({ ...s, mutedIds: (s.mutedIds || []).filter(x => x !== id) }));
}
function dedupById(list) {
  const m = new Map();
  for (const e of list) m.set(e.id, e);
  return Array.from(m.values());
}
function formatLocal(isoUtc) {
  try {
    const d = new Date(isoUtc);
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(d);
  } catch { return isoUtc; }
}
function exportJson(events) {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "news-events.json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function beep(freq = 220, ms = 180) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine"; o.frequency.value = freq;
  o.connect(g); g.connect(ctx.destination);
  o.start();
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
  o.stop(ctx.currentTime + ms / 1000 + 0.02);
}

/* ======== TradingEconomics (опционально) ======== */

function getEnv(keys) {
  if (typeof process !== "undefined" && process.env) {
    for (const k of keys) if (typeof process.env[k] !== "undefined") return process.env[k];
  }
  return undefined;
}
async function loadTECalendar({ from, to, countries = ["United States"], debug = false }) {
  const key = getEnv(["VITE_TE_KEY", "REACT_APP_TE_KEY"]) || "guest:guest";
  const url = new URL("https://api.tradingeconomics.com/calendar");
  url.searchParams.set("c", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("d1", from);
  url.searchParams.set("d2", to);
  if (countries?.length) url.searchParams.set("country", countries.join(","));
  const finalUrl = url.toString();
  if (debug) console.log("[TE] GET", finalUrl);
  const res = await fetch(finalUrl);
  if (!res.ok) throw new Error(`TE API error ${res.status}`);
  const raw = await res.json();
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const items = arr.map((e) => ({
    id: `${e?.DateUTC ?? e?.Date}__${e?.Event}__${e?.Country}`,
    timeUtc: e?.DateUTC || e?.Date,
    title: e?.Event || "Event",
    country: e?.Country || "Unknown",
    currency: e?.Currency || "USD",
    importance: teImportance(e?.Importance),
    actual: e?.Actual ?? null,
    forecast: e?.Forecast ?? null,
    previous: e?.Previous ?? null,
    source: "api",
  }));
  return { items, url: finalUrl };
}
function teImportance(imp) {
  if (typeof imp === "number") return imp >= 3 ? "high" : imp === 2 ? "medium" : "low";
  const s = String(imp || "").toLowerCase();
  if (s.includes("high")) return "high";
  if (s.includes("medium")) return "medium";
  if (s.includes("low")) return "low";
  return "low";
}

/* ======== CSV: распознавание и нормализация ======== */

/** Авторазделитель + кавычки (+ поддержка ; для немецкой/русской локали) */
function parseCSVAuto(text) {
  const delim = guessDelimiter(text); // ',' или ';'
  const rows = text.split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return [];
  const headers = splitCsvLine(rows[0], delim).map(h => h.trim());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = splitCsvLine(rows[i], delim);
    if (!cols.length) continue;
    const obj = {};
    headers.forEach((h, idx) => obj[h] = cols[idx]);
    out.push(obj);
  }
  return out;
}
function guessDelimiter(text) {
  const head = text.split(/\r?\n/)[0] || "";
  const c = (head.match(/,/g) || []).length;
  const s = (head.match(/;/g) || []).length;
  return s > c ? ";" : ",";
}
function splitCsvLine(line, delim) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === delim && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Приведение к общей модели, распознавание заголовков EN/DE/RU */
function parsedToEvents(arr, tzCsv = "ET") {
  const map = makeHeaderMap(arr[0] || {});
  const res = [];
  for (const r of arr) {
    const title   = pick(r, map.title)   || "Event";
    const country = normalizeCountry(pick(r, map.country) || "United States");
    const impRaw  = (pick(r, map.importance) || "").toString();
    const importance = normalizeImportance(impRaw);

    const dateStr = pick(r, map.date) || "";
    const timeStr = pick(r, map.time) || "";
    const isoUtc  = toUtcISO(dateStr, timeStr, tzCsv);

    res.push({
      id: `${isoUtc}__${title}__${country}`,
      timeUtc: isoUtc,
      title,
      country,
      importance,
      actual:   pick(r, map.actual)    ?? null,
      forecast: pick(r, map.forecast)  ?? null,
      previous: pick(r, map.previous)  ?? null,
      source: "csv",
    });
  }
  return res;
}

/** Карта синонимов заголовков (EN/DE/RU + вариации) */
function makeHeaderMap(sampleRowObj) {
  const keys = Object.keys(sampleRowObj || {}).map(k => k.toLowerCase().trim());

  const a = (variants) => {
    for (const v of variants) {
      const i = keys.indexOf(v);
      if (i >= 0) return Object.keys(sampleRowObj)[i];
    }
    return null;
  };

  return {
    date:      a(["date", "datum", "дата"]),
    time:      a(["time", "zeit", "время"]),
    country:   a(["country", "land", "страна", "region"]),
    title:     a(["event", "title", "termin", "ereignis", "событие", "subject"]),
    importance:a(["importance", "impact", "relevanz", "важность", "bedeutung"]),
    actual:    a(["actual", "revised", "факт", "wert"]),
    forecast:  a(["forecast", "прогноз", "schätzung"]),
    previous:  a(["previous", "vorherig", "предыдущее"]),
  };
}
function pick(obj, key) {
  return key ? obj[key] : undefined;
}

/** Важность → high/medium/low (★, High/Hohe, русские/немецкие слова) */
function normalizeImportance(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return "low";
  if (s.includes("★★★") || s.includes("***")) return "high";
  if (s.includes("★★")  || s.includes("**"))  return "medium";
  if (s.includes("★")   || s.includes("*"))    return "low";
  if (/high|hoch|hohe|высок/.test(s)) return "high";
  if (/medium|mittel|средн/.test(s))  return "medium";
  if (/low|niedrig|низк/.test(s))     return "low";
  return "low";
}

/** Страны → как в UI */
function normalizeCountry(c) {
  const s = String(c || "").toLowerCase().trim();
  if (s === "united states of america" || s === "usa" || s === "u.s." || s === "us") return "United States";
  if (s === "euro area" || s === "european union" || s === "eu area" || s === "eu") return "Euro Area";
  if (s === "united kingdom (uk)" || s === "u.k." || s === "uk" || s === "great britain") return "United Kingdom";
  if (s === "kanada") return "Canada";
  return c || "Unknown";
}

/** Построение ISO-UTC из даты/времени CSV (UTC / ET / LOCAL) */
function toUtcISO(dateStr, timeStr, tzCsv) {
  // Пробуем YYYY-MM-DD / DD.MM.YYYY / DD/MM/YYYY
  const d = parseDateFlexible(dateStr);
  const t = parseTimeFlexible(timeStr);
  const yyyy = d.y, mm = d.m, dd = d.d;
  const hh = t.h, mi = t.min;

  if (tzCsv === "UTC") {
    const iso = `${pad(yyyy)}-${pad(mm)}-${pad(dd)}T${pad(hh)}:${pad(mi)}:00.000Z`;
    return new Date(iso).toISOString();
  }

  if (tzCsv === "ET") {
    // учитываем DST Нью-Йорка
    const offsetMin = etOffsetMinutes(new Date(Date.UTC(yyyy, mm - 1, dd, hh, mi, 0)));
    // строим строку с оффсетом, например -04:00
    const sign = offsetMin <= 0 ? "+" : "-"; // offsetMin отрицательный для ET
    const abs = Math.abs(offsetMin);
    const offH = Math.floor(abs / 60), offM = abs % 60;
    const isoLike = `${pad(yyyy)}-${pad(mm)}-${pad(dd)}T${pad(hh)}:${pad(mi)}:00${sign}${pad(offH)}:${pad(offM)}`;
    return new Date(isoLike).toISOString();
  }

  // LOCAL — считаем, что CSV в локальной зоне браузера
  const local = new Date(yyyy, (mm - 1), dd, hh, mi, 0);
  return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
}

function parseDateFlexible(s) {
  const str = String(s || "").trim();
  // YYYY-MM-DD
  let m = /^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})$/.exec(str);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  // DD.MM.YYYY
  m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(str);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };
  // DD Mon YYYY (редко)
  m = /^(\d{1,2})\s+([A-Za-zа-яА-Я]{3,})\s+(\d{4})$/.exec(str);
  if (m) return { y: +m[3], m: monthNameToNum(m[2]), d: +m[1] };
  // fallback — сегодня
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}
function monthNameToNum(name) {
  const s = name.toLowerCase();
  const arr = [
    ["jan","янв"],["feb","фев"],["mar","мар"],["apr","апр"],["may","май","mai"],
    ["jun","jun","июн"],["jul","jul","июл"],["aug","aug","авг"],["sep","sep","сен"],
    ["oct","okt","окт"],["nov","nov","ноя"],["dec","dez","дек"]
  ];
  for (let i=0;i<12;i++){
    if (arr[i].some(x => s.startsWith(x))) return i+1;
  }
  return 1;
}
function parseTimeFlexible(s) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(s||"").trim());
  if (m) return { h:+m[1], min:+m[2] };
  return { h:0, min:0 };
}
function pad(n){ return String(n).padStart(2,"0"); }

/** Минуты смещения для Нью-Йорка (ET) в указанный день, с учётом DST */
function etOffsetMinutes(dUtc) {
  // Нью-Йорк: America/New_York — зимой -5, летом -4 (относительно UTC)
  // Возьмём offset через форматирование в этой TZ и вычислим разницу
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    // получаем строку локального времени NY, затем распарсим и сравним с UTC
    const parts = fmt.formatToParts(dUtc);
    const get = (t) => +parts.find(p => p.type === t).value;
    const y = get("year"), m = get("month"), d = get("day");
    const hh = get("hour"), mm = get("minute"), ss = get("second");
    const ny = Date.UTC(y, m-1, d, hh, mm, ss);
    const diffMin = (ny - dUtc.getTime()) / 60000; // обычно -300 или -240
    return diffMin; // отрицательное число
  } catch {
    // fallback: пусть будет лето
    return -240;
  }
}
