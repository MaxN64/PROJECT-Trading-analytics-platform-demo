import React, { useMemo, useRef, useState, useEffect } from "react";
import styles from "./TradesFullPage.module.css";

import Filters from "../components/Filters";
import { CONDITIONS as ALL_CONDITIONS } from "../components/Conditions";
import useFilteredTrades from "../hooks/useFilteredTrades";
import VoiceNote from "../components/VoiceNote";
import TradeMetricsModal from "../components/modals/TradeMetricsModal";
import MarketContextModal from "../components/modals/MarketContextModal";

import RiskLimitBar from "../components/RiskLimitBar";
import AnalyticsDashboard from "../components/analytics/AnalyticsDashboard";

import useTrades from "../hooks/useTradesApi";
import {
  uploadAttachment,
  streamUrl,
  dataUrlToBlob,
  deleteImage,
  deleteVoice,
  importVolfixCsv,
} from "../lib/api";

import TradeQualityAnalytics from "../components/analytics/TradeQualityAnalytics";

/* Подсказки по умолчанию */
const SUGGESTED_TAGS = [
  "в тренде", "контртренд", "высокая волатильность", "флэт", "новости",
  "пробой", "откат", "импульс", "вынос стопов", "перезаход",
];

/* ---------- УТИЛИТЫ ДЛЯ УСЛОВИЙ ---------- */
const CONDITIONS_BY_ID = ALL_CONDITIONS.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

function labelsFromIds(ids = []) {
  return ids.map((id) => CONDITIONS_BY_ID[id]?.label).filter(Boolean);
}
/* ---------------------------------------- */

export default function TradesFullPage() {
  const { trades, deleteTrade, patchTrade, refresh } = useTrades();

  // при первом рендере запрашиваем побольше записей (если хук поддерживает)
  useEffect(() => {
    try { refresh({ limit: 10000 }); } catch { refresh(); }
  }, [refresh]);

  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(
    () => trades.find((t) => (t.id || t._id) === selectedId) || null,
    [trades, selectedId]
  );

  // вкладки
  const [tab, setTab] = useState("list");

  // фильтры
  const [filters, setFilters] = useState(null);
  const [tagFilter, setTagFilter] = useState([]);

  // 1) фильтр панели
  const filteredByPanel = useFilteredTrades(trades, filters);

  // 2) фильтр по тегам
  const filtered = useMemo(() => {
    if (!tagFilter.length) return filteredByPanel;
    return filteredByPanel.filter((t) => {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      return tagFilter.every((tf) => tags.includes(tf));
    });
  }, [filteredByPanel, tagFilter]);

  // ---- теги ----
  const addTag = (tag) => {
    if (!selected) return;
    const value = String(tag || "").trim();
    if (!value) return;
    const current = Array.isArray(selected.tags) ? selected.tags : [];
    if (current.includes(value)) return;
    patchTrade(selected.id || selected._id, { tags: [...current, value] });
  };
  const removeTag = (tag) => {
    if (!selected) return;
    const current = Array.isArray(selected.tags) ? selected.tags : [];
    patchTrade(selected.id || selected._id, { tags: current.filter((t) => t !== tag) });
  };

  /* ---------------------- ФОТО (до 4) ---------------------- */
  const imageIds = useMemo(() => {
    if (!selected) return [];
    if (Array.isArray(selected.images) && selected.images.length) return selected.images.slice(0, 4);
    if (Array.isArray(selected.screenshotIds) && selected.screenshotIds.length) return selected.screenshotIds.slice(0, 4);
    if (selected.screenshotId) return [selected.screenshotId];
    return [];
  }, [selected]);

  const imagesCount = imageIds.length;
  const imagesInputRef = useRef(null);
  const handlePickImages = () => imagesInputRef.current?.click();

  const handleAddImages = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      ["image/png", "image/jpeg", "image/webp"].includes(f.type)
    );
    e.target.value = "";
    if (!files.length || !selected) return;

    const room = Math.max(0, 4 - imagesCount);
    const toUpload = files.slice(0, room);
    if (!toUpload.length) {
      // простое уведомление; можно заменить на тост
      console.warn("Можно прикрепить максимум 4 фото к одной сделке.");
      return;
    }

    const id = selected.id || selected._id;
    for (const file of toUpload) {
      // eslint-disable-next-line no-await-in-loop
      await uploadAttachment(id, file, { kind: "image", name: file.name });
    }
    await refresh();
  };

  const removeImage = async (fileId) => {
    if (!selected) return;
    const id = selected.id || selected._id;
    await deleteImage(id, fileId);
    await refresh();
  };

  /* ---------------------- голосовая заметка ---------------------- */
  const handleVoiceSave = async (dataUrl) => {
    if (!selected) return;
    const blob = dataUrlToBlob(dataUrl);
    const file = new File([blob], "voice.webm", { type: blob.type || "audio/webm" });
    await uploadAttachment(selected.id || selected._id, file, { kind: "audio", name: "voice.webm" });
    await refresh();
  };
  const removeVoice = async () => {
    if (!selected) return;
    await deleteVoice(selected.id || selected._id);
    await refresh();
  };

  /* ---------------------- модалки ---------------------- */
  const [openMetrics, setOpenMetrics] = useState(false);
  const [openCtx, setOpenCtx] = useState(false);

  /* ---------------------- Лайтбокс ---------------------- */
  const [lightbox, setLightbox] = useState(null);
  const openLightbox = (src, name) => setLightbox({ src, name });
  const closeLightbox = () => setLightbox(null);

  /* ---------------------- Risk bar ---------------------- */
  const todayR = useMemo(() => {
    const today = new Date().toDateString();
    return trades
      .filter((t) => new Date(t.createdAt).toDateString() === today)
      .reduce((a, b) => a + (Number(b.netR) || 0), 0);
  }, [trades]);

  const weekR = useMemo(() => {
    const now = new Date();
    return trades
      .filter((t) => ((now - new Date(t.createdAt)) / 86400000) <= 7)
      .reduce((a, b) => a + (Number(b.netR) || 0), 0);
  }, [trades]);

  /* ---------------------- УСЛОВИЯ: локальный драфт ---------------------- */
  const [condDraft, setCondDraft] = useState([]);
  useEffect(() => {
    setCondDraft(Array.isArray(selected?.conditions) ? selected.conditions : []);
  }, [selected]);

  const toggleCond = (id) => {
    setCondDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const dirtyCond = useMemo(() => {
    const a = [...(selected?.conditions || [])].sort();
    const b = [...condDraft].sort();
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [selected, condDraft]);

  const saveCond = async () => {
    if (!selected) return;
    await patchTrade(selected.id || selected._id, { conditions: condDraft });
    await refresh();
  };

  const resetCond = () => {
    setCondDraft(Array.isArray(selected?.conditions) ? selected.conditions : []);
  };

  /* ---------------------- Комментарий: драфт + дебаунс PATCH ---------------------- */
  const [commentDraft, setCommentDraft] = useState("");
  useEffect(() => { setCommentDraft(selected?.comment || ""); }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const id = selected.id || selected._id;
    const initial = selected.comment || "";
    if (commentDraft === initial) return;
    const h = setTimeout(async () => {
      try { await patchTrade(id, { comment: commentDraft }); } catch {}
    }, 600);
    return () => clearTimeout(h);
  }, [commentDraft, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------- Импорт из VolFix ---------------------- */
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importRes, setImportRes] = useState(null);
  const [form, setForm] = useState({
    instrument: "ES",
    tickSize: 0.25,
    tickValue: 12.5,
    update: true,
    dry: false,
  });

  const handleInstrChange = (val) => {
    const up = String(val || "").toUpperCase();
    const next = { ...form, instrument: up };
    if (up === "ES") { next.tickSize = 0.25; next.tickValue = 12.5; }
    else if (up === "MES") { next.tickSize = 0.25; next.tickValue = 1.25; }
    else if (up === "FGBL") { next.tickSize = 0.01; next.tickValue = 10; }
    setForm(next);
  };

  const runImport = async () => {
    if (!importFile) { console.warn("Выберите CSV файл из VolFix."); return; }
    setImportBusy(true);
    setImportRes(null);
    try {
      const data = await importVolfixCsv({
        file: importFile,
        instrument: form.instrument,
        tickSize: form.tickSize,
        tickValue: form.tickValue,
        dry: form.dry,
        update: form.update,
      });
      setImportRes(data);
      if (!form.dry) await refresh();
    } catch (err) {
      setImportRes({ error: String(err) });
    } finally {
      setImportBusy(false);
    }
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportBusy(false);
    setImportFile(null);
    setImportRes(null);
  };

  /* ---------------------- Применить метрики VJ к сделкам дня ---------------------- */
  const [batchInfo, setBatchInfo] = useState(null); // { ok, fail, date }

  async function batchApplyVJ(dayYYYYMMDD, enrichedRows) {
    if (!Array.isArray(enrichedRows) || !enrichedRows.length) return;

    let ok = 0; let fail = 0;
    for (const r of enrichedRows) {
      const patch = {
        // профиль дня
        vj_day: dayYYYYMMDD,
        vj_poc: r.POC, vj_val: r.VAL, vj_vah: r.VAH,

        // метрики на уровне входной цены
        vj_vol_at_entry: r.vj_vol_at_entry,
        vj_vol_pctile: r.vj_vol_pctile,
        vj_is_HVN: !!r.vj_is_HVN,
        vj_is_LVN: !!r.vj_is_LVN,
        vj_in_value_area: !!r.vj_in_value_area,
        vj_dist_to_poc_ticks: r.vj_dist_to_poc_ticks,
        vj_va_edge_dist_ticks: r.vj_va_edge_dist_ticks,
        vj_delta_agg: r.vj_delta_agg,
        vj_delta_rank: r.vj_delta_rank,
        vj_delta_opposes_side: !!r.vj_delta_opposes_side,
        vj_edge_slope: r.vj_edge_slope,
        vj_thin_behind: !!r.vj_thin_behind,
        vj_vol_es_equiv: r.vj_vol_es_equiv,

        // дополнительно (для отчётов/фильтров)
        vj_level_score: r.levelScore,
        vj_gate_pass: !!r.pass,
        vj_flags: r.flags || [],
      };
      try {
        // eslint-disable-next-line no-await-in-loop
        await patchTrade(r.id, patch);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    await refresh();

    setBatchInfo({ ok, fail, date: dayYYYYMMDD });
    setTimeout(() => setBatchInfo(null), 5000);
  }

  /* ---------------------- Подтверждение удаления ---------------------- */
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const askDelete = (e, id, index) => {
    e.stopPropagation();
    setConfirmDel({ id, index });
  };

  const cancelDelete = () => setConfirmDel(null);

  const confirmDelete = async () => {
    if (!confirmDel) return;
    try {
      setConfirmBusy(true);
      await deleteTrade(confirmDel.id);
      if (selectedId === confirmDel.id) setSelectedId(null);
      await refresh();
    } finally {
      setConfirmBusy(false);
      setConfirmDel(null);
    }
  };

  return (
    <div className={styles.page}>
      {/* --- ПРИЛИПШИЙ ВЕРХ ---- */}
      <div className={styles.stickyTop}>
        <header className={styles.header}>
          <h2>Таблица сделок</h2>
          <div className={styles.headerRight}>
            {/* кнопка импорта VolFix */}
            <button className={styles.primaryBtn} onClick={() => setImportOpen(true)}>
              Загрузка с VolFix
            </button>

            <TagFilter
              suggestions={collectAllTags(filteredByPanel)}
              active={tagFilter}
              onToggle={(tag) =>
                setTagFilter((prev) =>
                  prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                )
              }
              onClear={() => setTagFilter([])}
            />
            <button className={styles.closeBtn} onClick={() => window.history.back()} aria-label="Закрыть страницу">
              ✕
            </button>
          </div>
        </header>

        {batchInfo && (
          <div className={`${styles.status} ${batchInfo.fail ? styles.err : styles.ok}`} role="status" aria-live="polite">
            {batchInfo.ok} ок{batchInfo.fail ? `, ${batchInfo.fail} ошибок` : ""} · дата {batchInfo.date}
          </div>
        )}

        <div className={styles.filtersWrap}>
          <Filters allConditions={ALL_CONDITIONS} totalCount={trades.length} onChange={setFilters} />
          <div className={styles.countLine}>
            Отфильтровано: <b>{filtered.length}</b> из {trades.length}
          </div>
        </div>

        <div style={{ margin: "8px 0" }}>
          <RiskLimitBar
            dayRiskLimitR={-3}
            weekRiskLimitR={-10}
            dayRealizedR={todayR}
            weekRealizedR={weekR}
          />
        </div>

        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
          <button
            onClick={() => setTab("list")}
            className={tab === "list" ? styles.tabOn : styles.tab}
            aria-pressed={tab === "list"}
          >
            Список
          </button>
          <button
            onClick={() => setTab("analytics")}
            className={tab === "analytics" ? styles.tabOn : styles.tab}
            aria-pressed={tab === "analytics"}
          >
            Аналитика
          </button>
        </div>
      </div>
      {/* --- /ПРИЛИПШИЙ ВЕРХ ---- */}

      {tab === "list" ? (
        <div className={styles.layout}>
          {/* Список сделок */}
          <section className={styles.list}>
            <div className={`${styles.row} ${styles.head}`}>
              <div>#</div>
              <div>Время</div>
              <div>Side</div>
              <div>Инстр.</div>
              <div>SL (п.)</div>
              <div>Контр.</div>
              <div>$P&L</div>
              <div>R</div>
              <div>Откр. цена</div>
              <div>Закр. цена</div>
              <div>Комиссия</div>
              <div>Pips</div>
              <div>DD ($)</div>
              <div>Условия</div>
              <div>Теги</div>
              <div className={styles.actionsCol}>Действия</div>
            </div>

            {filtered.length === 0 ? (
              <div className={styles.empty}>Нет сделок для выбранных фильтров.</div>
            ) : (
              filtered.map((t, idx) => {
                const id = t.id || t._id;

                const imgsCount =
                  (Array.isArray(t.images) && t.images.length) ? t.images.length
                  : (Array.isArray(t.screenshotIds) && t.screenshotIds.length) ? t.screenshotIds.length
                  : (t.screenshotId ? 1 : 0);

                const condLabels = labelsFromIds(t.conditions || []);
                const condFull = condLabels.join(", ");

                const visualIndex = t.index ?? filtered.length - idx;

                return (
                  <div
                    key={id}
                    className={`${styles.row} ${selectedId === id ? styles.active : ""}`}
                    onClick={() => setSelectedId(id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(id); }}
                    aria-label={`Открыть сделку ${visualIndex}`}
                  >
                    <div>{visualIndex}</div>
                    <div>{formatDT(t.createdAt)}</div>
                    <div className={t.side === "BUY" ? styles.buy : styles.sell}>{t.side || "—"}</div>
                    <div>{t.instrument || "—"}</div>
                    <div>{formatNum(t.stopPoints)}</div>
                    <div>{t.contracts ?? t.size ?? "—"}</div>
                    <div className={Number(t.pnl) >= 0 ? styles.win : styles.loss}>{formatMoney(t.pnl)}</div>
                    <div className={Number(t.netR) >= 0 ? styles.win : styles.loss}>{formatNum(t.netR)}</div>
                    <div>{formatNum(t.openPrice)}</div>
                    <div>{formatNum(t.closePrice)}</div>
                    <div>{formatMoney(t.fee)}</div>
                    <div>{formatNum(t.pips)}</div>
                    <div className={styles.dd}>{formatMoney(t.drawdownCash ?? t.cashDrawdown)}</div>

                    <div className={styles.condCell} title={condFull}>
                      {condFull || "—"}
                    </div>

                    <div className={styles.tagsCell}>
                      {(Array.isArray(t.tags) ? t.tags : []).map((tg) => (
                        <span key={tg} className={styles.tag}>{tg}</span>
                      ))}
                      {!!t.comment && <span className={styles.dot} title="Есть комментарий" />}
                      {imgsCount > 0 && <span className={styles.dotBlue} title={`Фото: ${imgsCount}`} />}
                      {!!t.voiceNoteId && <span className={styles.dot} title="Есть голосовая заметка" />}
                    </div>

                    <div className={styles.actions}>
                      <button
                        className={styles.danger}
                        onClick={(e) => askDelete(e, id, visualIndex)}
                        aria-label={`Удалить сделку ${visualIndex}`}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* Панель редактирования выбранной сделки */}
          <aside className={styles.details}>
            {!selected ? (
              <div className={styles.placeholder}>
                Выберите сделку слева, чтобы добавить комментарий, теги или вложения.
              </div>
            ) : (
              <>
                <h3>Сделка #{selected.index ?? ""}</h3>

                <div className={styles.kv}><span>Время:</span><span>{formatDT(selected.createdAt)}</span></div>
                <div className={styles.kv}><span>Инструмент:</span><span>{selected.instrument || "—"}</span></div>
                <div className={styles.kv}>
                  <span>Side:</span>
                  <span className={selected.side === "BUY" ? styles.buy : styles.sell}>{selected.side || "—"}</span>
                </div>
                <div className={styles.kv}><span>Стоп-лосс:</span><span>{formatNum(selected.stopPoints)} п.</span></div>
                <div className={styles.kv}><span>Контрактов:</span><span>{selected.contracts ?? selected.size ?? "—"}</span></div>
                <div className={styles.kv}><span>Откр. цена:</span><span>{formatNum(selected.openPrice)}</span></div>
                <div className={styles.kv}><span>Закр. цена:</span><span>{formatNum(selected.closePrice)}</span></div>
                <div className={styles.kv}><span>Комиссия:</span><span>{formatMoney(selected.fee)}</span></div>
                <div className={styles.kv}>
                  <span>P&L ($):</span>
                  <span className={Number(selected.pnl) >= 0 ? styles.win : styles.loss}>
                    {formatMoney(selected.pnl)}
                  </span>
                </div>
                <div className={styles.kv}>
                  <span>R (net):</span>
                  <span className={Number(selected.netR) >= 0 ? styles.win : styles.loss}>
                    {formatNum(selected.netR)}
                  </span>
                </div>
                <div className={styles.kv}><span>Pips:</span><span>{formatNum(selected.pips)}</span></div>
                <div className={styles.kv}><span>Drawdown ($):</span><span className={styles.dd}>{formatMoney(selected.drawdownCash ?? selected.cashDrawdown)}</span></div>

                {/* УСЛОВИЯ ВХОДА */}
                <div className={styles.block}>
                  <label className={styles.label}>Условия входа</label>

                  <div className={styles.condSelSummary}>
                    {condDraft.length
                      ? labelsFromIds(condDraft).join(", ")
                      : <span className={styles.muted}>— ничего не выбрано</span>}
                  </div>

                  <div className={styles.condWrap}>
                    {ALL_CONDITIONS.map((c) => {
                      const on = condDraft.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          className={`${styles.condChip} ${on ? styles.condOn : ""}`}
                          onClick={() => toggleCond(c.id)}
                          title={c.label}
                          type="button"
                          aria-pressed={on}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.condBar}>
                    <button
                      className={styles.condSaveBtn}
                      disabled={!dirtyCond}
                      onClick={saveCond}
                    >
                      Сохранить условия
                    </button>
                    <button
                      className={styles.condResetBtn}
                      disabled={!dirtyCond}
                      onClick={resetCond}
                    >
                      Отменить
                    </button>
                  </div>

                  <div className={styles.hint}>
                    R появится, когда вы зададите SL (в пунктах) у сделки.
                  </div>
                </div>

                <div className={styles.block}>
                  <label className={styles.label}>Комментарий</label>
                  <textarea
                    className={styles.textarea}
                    rows={4}
                    placeholder="Например: Вошёл поздно, рынок ускорился."
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                  />
                  <div className={styles.hint}>Сохраняется автоматически (через ~0.6с паузы ввода).</div>
                </div>

                <div className={styles.block}>
                  <label className={styles.label}>Теги</label>
                  <TagEditor
                    value={Array.isArray(selected.tags) ? selected.tags : []}
                    onAdd={addTag}
                    onRemove={removeTag}
                    suggestions={SUGGESTED_TAGS}
                  />
                </div>

                {/* Метрики/Контекст */}
                <div className={styles.block} style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setOpenMetrics(true)}>Метрики сделки</button>
                  <button onClick={() => setOpenCtx(true)}>Контекст рынка</button>
                </div>
                <TradeMetricsModal
                  open={openMetrics}
                  trade={selected}
                  onClose={() => setOpenMetrics(false)}
                  onSave={async (patch) => {
                    await patchTrade(selected.id || selected._id, patch);
                    await refresh();
                  }}
                />
                <MarketContextModal
                  open={openCtx}
                  trade={selected}
                  onClose={() => setOpenCtx(false)}
                  onSave={async (patch) => {
                    await patchTrade(selected.id || selected._id, patch);
                    await refresh();
                  }}
                />

                {/* Фото (до 4) */}
                <div className={styles.block}>
                  <label className={styles.label}>Фото (до 4)</label>

                  <input
                    ref={imagesInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className={styles.file}
                    onChange={handleAddImages}
                  />

                  <div className={styles.photoGrid}>
                    {imageIds.map((fid) => (
                      <figure key={fid} className={styles.thumb}>
                        <img
                          src={streamUrl(fid)}
                          alt="Фото сделки"
                          className={styles.thumbImg}
                          onClick={() =>
                            openLightbox(streamUrl(fid), `trade_${selected.index}.png`)
                          }
                        />
                        <figcaption className={styles.thumbBar}>
                          <a className={styles.button} href={streamUrl(fid)} download>
                            Скачать
                          </a>
                          <button
                            className={styles.danger}
                            onClick={() => removeImage(fid)}
                          >
                            Удалить
                          </button>
                        </figcaption>
                      </figure>
                    ))}

                    {imagesCount < 4 && (
                      <button className={styles.addTile} onClick={handlePickImages} aria-label="Добавить фото">
                        <span className={styles.plus}>＋</span>
                        <span className={styles.addTxt}>Добавить фото ({imagesCount}/4)</span>
                      </button>
                    )}
                  </div>

                  <div className={styles.hint}>
                    Файлы хранятся в базе (GridFS). Можно прикрепить до четырёх изображений.
                  </div>
                </div>

                {/* Голосовая заметка */}
                <div className={styles.block}>
                  <label className={styles.label}>Голосовая заметка</label>
                  <VoiceNote
                    value={selected.voiceNoteId ? streamUrl(selected.voiceNoteId) : null}
                    onSave={handleVoiceSave}
                    onDelete={removeVoice}
                  />
                  <div className={styles.hint}>Запись хранится в базе (GridFS), не пропадёт.</div>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : (
        // ==== ВКЛАДКА АНАЛИТИКИ С СОБСТВЕННЫМ СКРОЛЛОМ ====
        <div className={styles.analyticsScroll}>
          <AnalyticsDashboard trades={filtered} />
          <TradeQualityAnalytics
            trades={filtered}
            onBatchApply={batchApplyVJ}
          />
        </div>
      )}

      {/* Модалка импорта VolFix */}
      {importOpen && (
        <div className={styles.modalBackdrop} onClick={closeImport}>
          <div className={styles.modal} onClick={(e)=>e.stopPropagation()}>
            <div className={styles.modalTitle}>Загрузка из VolFix (Statement → Positions)</div>

            <div className={styles.modalRow}>
              <label>Инструмент</label>
              <div className={styles.rowInline}>
                <select
                  value={form.instrument}
                  onChange={(e)=>handleInstrChange(e.target.value)}
                  className={styles.input}
                >
                  <option value="ES">ES</option>
                  <option value="MES">MES</option>
                  <option value="FGBL">FGBL</option>
                  <option value={form.instrument}>— свой —</option>
                </select>
                <input
                  className={styles.input}
                  value={form.instrument}
                  onChange={(e)=>handleInstrChange(e.target.value)}
                  placeholder="например ES"
                />
              </div>
            </div>

            <div className={styles.modalRow}>
              <label>tickSize</label>
              <input type="number" step="0.01" className={styles.input}
                     value={form.tickSize}
                     onChange={(e)=>setForm(f=>({...f, tickSize: Number(e.target.value)}))} />
            </div>

            <div className={styles.modalRow}>
              <label>tickValue ($/tick)</label>
              <input type="number" step="0.01" className={styles.input}
                     value={form.tickValue}
                     onChange={(e)=>setForm(f=>({...f, tickValue: Number(e.target.value)}))} />
            </div>

            <div className={styles.modalRow}>
              <label>CSV файл</label>
              <input type="file" accept=".csv,text/csv" className={styles.input}
                     onChange={(e)=>setImportFile(e.target.files?.[0] || null)} />
            </div>

            <div className={styles.modalRowCheck}>
              <label className={styles.check}>
                <input type="checkbox" checked={form.update} onChange={(e)=>setForm(f=>({...f, update: e.target.checked}))} />
                <span>Обновить существующие (update=1)</span>
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={form.dry} onChange={(e)=>setForm(f=>({...f, dry: e.target.checked}))} />
                <span>Сухой прогон (dry=1)</span>
              </label>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={closeImport} disabled={importBusy}>Отмена</button>
              <button className={styles.primaryBtn} onClick={runImport} disabled={importBusy}>
                {importBusy ? "Импорт..." : "Импортировать"}
              </button>
            </div>

            {importRes && (
              <div className={styles.importResult}>
                {"error" in importRes ? (
                  <div className={styles.err}>Ошибка: {String(importRes.error)}</div>
                ) : (
                  <>
                    <div>OK: <b>{String(importRes.ok)}</b></div>
                    {"imported" in importRes && <div>Добавлено: <b>{importRes.imported}</b></div>}
                    {"updated" in importRes && <div>Обновлено: <b>{importRes.updated}</b></div>}
                    {"skipped" in importRes && <div>Пропущено: <b>{importRes.skipped}</b></div>}
                    {importRes.reasons && (
                      <div className={styles.reasons}>
                        <div>Причины пропуска:</div>
                        <ul>
                          {Object.entries(importRes.reasons).map(([k,v])=>(
                            <li key={k}><code>{k}</code>: {v}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className={styles.hint} style={{marginTop:8}}>
              Импорт сохраняет <b>pricePerPoint</b> (сколько $ за пункт на контракт).
              <br/>R появится после того, как вы введёте <b>SL (пункты)</b> у сделки.
              <br/>Для FGBL: tickSize=0.01, tickValue=10.
            </div>
          </div>
        </div>
      )}

      {/* Модалка подтверждения удаления */}
      {confirmDel && (
        <div className={styles.modalBackdrop} onClick={cancelDelete}>
          <div className={styles.confirmBox} role="dialog" aria-modal="true" onClick={(e)=>e.stopPropagation()}>
            <div className={styles.modalTitle}>Подтвердите удаление</div>
            <p className={styles.confirmText}>
              Удалить сделку <b>#{confirmDel.index}</b>? Это действие необратимо.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.ghostBtn} onClick={cancelDelete} disabled={confirmBusy}>
                Отмена
              </button>
              <button className={styles.confirmDanger} onClick={confirmDelete} disabled={confirmBusy} aria-label="Подтвердить удаление">
                {confirmBusy ? "Удаляю..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Лайтбокс */}
      {lightbox && (
        <div className={styles.lightbox} role="dialog" aria-modal="true" onClick={closeLightbox}>
          <div className={styles.lightboxInner} onClick={(e) => e.stopPropagation()}>
            <button className={styles.lightboxClose} onClick={closeLightbox} aria-label="Закрыть предпросмотр">
              ✕
            </button>
            <img src={lightbox.src} alt={lightbox.name || "Скриншот"} className={styles.lightboxImg} />
            <div className={styles.lightboxBar}>
              <span className={styles.lightboxName}>{lightbox.name || "screenshot"}</span>
              <a className={styles.lightboxDownload} href={lightbox.src} download>
                Скачать
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------ вспомогательные компоненты ------------------------ */
function TagEditor({ value, onAdd, onRemove, suggestions }) {
  const [input, setInput] = useState("");
  const addAndClear = () => { onAdd(input); setInput(""); };
  return (
    <div className={styles.tags}>
      <div className={styles.tagList}>
        {value.map((tg) => (
          <span key={tg} className={styles.tag}>
            {tg}
            <button className={styles.tagX} onClick={() => onRemove(tg)} aria-label={`Убрать тег ${tg}`}>×</button>
          </span>
        ))}
      </div>

      <div className={styles.tagControls}>
        <input
          className={styles.tagInput}
          placeholder="Добавить тег и Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addAndClear(); }
          }}
        />
        <button onClick={addAndClear}>Добавить</button>
      </div>

      {!!suggestions?.length && (
        <div className={styles.suggests}>
          {suggestions.map((s) => (
            <button key={s} className={styles.suggest} onClick={() => onAdd(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TagFilter({ active, onToggle, onClear, suggestions }) {
  return (
    <div className={styles.filter}>
      <span className={styles.fLabel}>Фильтр по тегам:</span>
      <div className={styles.fChips}>
        {suggestions.map((t) => {
          const on = active.includes(t);
          return (
            <button
              key={t}
              className={`${styles.chip} ${on ? styles.on : ""}`}
              onClick={() => onToggle(t)}
              aria-pressed={on}
            >
              {t}
            </button>
          );
        })}
      </div>
      {active.length > 0 && (
        <button className={styles.clear} onClick={onClear}>
          Сбросить теги
        </button>
      )}
    </div>
  );
}

/* ------------------------------- утилиты ----------------------------------- */
function formatDT(ts) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "—";
  }
}
function formatMoney(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}
function formatNum(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return String(Math.round(n * 100) / 100);
}
function collectAllTags(trades) {
  const set = new Set();
  for (const t of trades || []) {
    for (const tag of Array.isArray(t.tags) ? t.tags : []) set.add(tag);
  }
  return Array.from(set.size ? set : new Set(SUGGESTED_TAGS));
}

