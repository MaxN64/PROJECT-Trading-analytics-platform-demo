import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { parse as csvParse } from "csv-parse/sync";
import { getDb } from "../db.js";

const router = express.Router();

/* ----------------------------- multer ----------------------------- */
/** Принимаем CSV как multipart/form-data (поле name="file") */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/* ---------------------------- helpers ----------------------------- */

// Универсальный парсер дат VolFix.
function parseVolfixDate(s) {
  if (!s) return null;
  s = String(s).trim().replace(/\u200E|\u200F/g, "");

  // dd.MM.yy(yy) HH:mm[:ss]
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    let [, dd, mm, yy, HH, MM, SS] = m;
    let Y = Number(yy);
    if (yy.length === 2) Y = Y < 70 ? 2000 + Y : 1900 + Y;
    return new Date(Y, Number(mm) - 1, Number(dd), Number(HH), Number(MM), Number(SS || 0));
  }

  // dd/MM/yy(yy) HH:mm[:ss]
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    let [, dd, mm, yy, HH, MM, SS] = m;
    let Y = Number(yy);
    if (yy.length === 2) Y = Y < 70 ? 2000 + Y : 1900 + Y;
    return new Date(Y, Number(mm) - 1, Number(dd), Number(HH), Number(MM), Number(SS || 0));
  }

  // ISO: yyyy-MM-dd HH:mm[:ss] или yyyy-MM-ddTHH:mm[:ss]
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, Y, M, D, HH, MM, SS] = m;
    return new Date(Number(Y), Number(M) - 1, Number(D), Number(HH), Number(MM), Number(SS || 0));
  }

  return null;
}

// Числа из VolFix: убираем $, пробелы/разделители, запятую -> точку; сохраняем знак
function toNumber(v) {
  if (v === null || v === undefined) return null;
  let s = String(v)
    .replace(/\u00A0|\u2009/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\$/g, "")
    .trim();

  const neg = /^-/.test(s) || /-\$/.test(s) || /\$-/.test(s) ? -1 : 1;

  s = s.replace(/^-|\$-|-?\$/g, "").trim();
  s = s.replace(/\s/g, "");
  s = s.replace(",", ".");

  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return neg * Math.abs(n);
}

// Определяем разделитель ; или , по первым килобайтам
function detectDelimiter(text) {
  const head = text.slice(0, 2000);
  const sc = (head.match(/;/g) || []).length;
  const cc = (head.match(/,/g) || []).length;
  return sc >= cc ? ";" : ",";
}

/** Формат "yyyy-MM-dd HH:mm:ss" */
function fmt(ts) {
  if (!(ts instanceof Date)) return ts;
  const Y = ts.getFullYear();
  const M = String(ts.getMonth() + 1).padStart(2, "0");
  const D = String(ts.getDate()).padStart(2, "0");
  const h = String(ts.getHours()).padStart(2, "0");
  const m = String(ts.getMinutes()).padStart(2, "0");
  const s = String(ts.getSeconds()).padStart(2, "0");
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

/**
 * Группировка строк CSV по "Open Order".
 * Суммируем: Size, P&L, Fee. Pips — НЕ суммируем (берём первое ненулевое значение).
 * Даты: open = min(Open Date), close = max(Close Date).
 * Close Price/Close Order — из самой поздней строки.
 */
function groupByOpenOrder(rows) {
  const byOpen = new Map();

  for (const r of rows) {
    const openId = String(r["Open Order"] ?? r["open order"] ?? "").trim();
    const key = openId || `__NOOPEN__${Math.random()}`;
    if (!byOpen.has(key)) byOpen.set(key, []);
    byOpen.get(key).push(r);
  }

  const out = [];
  for (const [key, arr] of byOpen.entries()) {
    if (String(key).startsWith("__NOOPEN__")) { out.push(arr[0]); continue; }

    const first = arr[0];

    const sum = (name) => arr.reduce((a, x) => a + (toNumber(x[name]) || 0), 0);
    const maxByClose = arr.reduce(
      (acc, x) => {
        const d = parseVolfixDate(x["Close Date"] ?? x["close date"]);
        if (!acc.d || (d && d > acc.d)) return { d, row: x };
        return acc;
      },
      { d: null, row: first }
    );
    const minOpenDate = arr.reduce((acc, x) => {
      const d = parseVolfixDate(x["Open Date"] ?? x["open date"]);
      if (!acc || (d && d < acc)) return d;
      return acc;
    }, null);

    const agg = { ...first };

    // Суммируем только то, что нужно
    agg["Size"] = String(sum("Size"));
    agg["P&L"]  = String(sum("P&L"));
    agg["Fee"]  = String(sum("Fee"));

    // Pips НЕ суммируем — берём из первой (или первого ненулевого)
    const pipsValues = arr
      .map(x => toNumber(x["Pips"] ?? x["pips"]))
      .filter(v => v != null);
    if (pipsValues.length) {
      const firstPips = pipsValues[0];
      agg["Pips"] = String(firstPips);
    }

    // Даты/цены/ордера
    agg["Open Date"]   = minOpenDate ? fmt(minOpenDate) : (first["Open Date"] ?? first["open date"]);
    agg["Close Date"]  = maxByClose.row["Close Date"] ?? maxByClose.row["close date"];
    agg["Close Price"] = maxByClose.row["Close Price"] ?? maxByClose.row["close price"];
    agg["Open Order"]  = key;
    agg["Close Order"] = maxByClose.row["Close Order"] ?? maxByClose.row["close order"];

    out.push(agg);
  }

  return out;
}

/* ------------------------------ route ----------------------------- */

/**
 * POST /api/integrations/volfix/import?instrument=ES&tickSize=0.25&tickValue=12.5&dry=1&update=1
 *
 * НОВОЕ: строки с одинаковым "Open Order" агрегируются в одну сделку.
 * Уникальный ключ = openOrderId.
 */
router.post("/integrations/volfix/import", upload.single("file"), async (req, res) => {
  try {
    const instrument = String(req.query.instrument || "ES").toUpperCase();
    const tickSize   = Number(req.query.tickSize ?? 0.25);
    const tickValue  = Number(req.query.tickValue ?? 12.5);
    const dryRun     = String(req.query.dry || "0") === "1";
    const updateMode = String(req.query.update || "0") === "1";

    const userIdRaw =
      req.headers["x-user-id"] ||
      req.user?.id ||
      req.user?._id ||
      "000000000000000000000001";

    const userId = new mongoose.Types.ObjectId(String(userIdRaw));

    // ---- читаем CSV ----
    let text = "";
    if (req.file?.buffer?.length) {
      text = req.file.buffer.toString("utf8");
    } else if (req.is("text/*") || req.is("application/octet-stream")) {
      const chunks = [];
      for await (const ch of req) chunks.push(ch);
      text = Buffer.concat(chunks).toString("utf8");
    } else if (req.is("application/json")) {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const grouped = groupByOpenOrder(rows);
      return await processRows(grouped, {
        instrument, tickSize, tickValue, dryRun, updateMode, userId
      }, res);
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No CSV uploaded. Send multipart/form-data with field 'file'." });
    }

    const delimiter = detectDelimiter(text);
    const rows = csvParse(text, {
      columns: true,
      skip_empty_lines: true,
      delimiter,
      trim: true,
    });

    // Агрегация по Open Order — всегда включена
    const grouped = groupByOpenOrder(rows);

    return await processRows(grouped, {
      instrument, tickSize, tickValue, dryRun, updateMode, userId
    }, res);

  } catch (err) {
    console.error("volfix/import error:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

/* ------------------------- core processing ------------------------ */

async function processRows(rows, opts, res) {
  const { instrument, tickSize, tickValue, dryRun, updateMode, userId } = opts;

  const reasons = {
    filteredInstrument: 0,
    badNumbers: 0,
    zeroSize: 0,
    noCloseDate: 0,
    duplicate: 0,
    duplicateInFile: 0,
  };
  let imported = 0;
  let updated  = 0;
  let skipped  = 0;
  const sample = [];

  // для диагностики форматов дат при dry-run
  const debugBadCloseDate = new Set();

  const db = getDb();
  const col = db.collection("trades");

  const pricePerPoint = (tickSize && tickValue) ? (tickValue / tickSize) : null;

  // чтобы dry-run был честным
  const seenInBatch = new Set();

  for (const r of rows) {
    const symbol = String(r["Symbol"] ?? r["symbol"] ?? "").trim();
    if (!symbol || !symbol.toUpperCase().startsWith(instrument + "(")) {
      reasons.filteredInstrument++; skipped++; continue;
    }

    const side         = String(r["Side"] ?? r["side"] ?? "").toUpperCase(); // BUY/SELL
    const size         = toNumber(r["Size"] ?? r["size"]);
    const pnl$         = toNumber(r["P&L"] ?? r["Pnl"] ?? r["pnl"]);
    const fee$         = toNumber(r["Fee"] ?? r["fee"]);
    const openPrice    = toNumber(r["Open Price"] ?? r["open price"] ?? r["open"]);
    const closePrice   = toNumber(r["Close Price"] ?? r["close price"] ?? r["close"]);
    const openDateRaw  = r["Open Date"]  ?? r["open date"];
    const closeDateRaw = r["Close Date"] ?? r["close date"];
    const openDate     = parseVolfixDate(openDateRaw);
    const closeDate    = parseVolfixDate(closeDateRaw);
    const openOrderId  = String(r["Open Order"]  ?? r["open order"]  ?? "").trim();
    const closeOrderId = String(r["Close Order"] ?? r["close order"] ?? "").trim();

    // Доп. поля из CSV
    const pipsVal      = toNumber(r["Pips"] ?? r["pips"]);
    const ddPts        = toNumber(r["Drawdown"] ?? r["drawdown"]);           // в пунктах
    const ddCash       = toNumber(r["Cash Drawdown"] ?? r["cash drawdown"]); // в $

    if (!closeDate) {
      reasons.noCloseDate++; skipped++;
      if (dryRun && closeDateRaw) {
        const s = String(closeDateRaw).trim();
        if (s) debugBadCloseDate.add(s);
      }
      continue;
    }

    if (size == null || pnl$ == null) { reasons.badNumbers++; skipped++; continue; }
    if (!size || size === 0) { reasons.zeroSize++; skipped++; continue; }

    const baseDoc = {
      userId,
      instrument,
      side, // BUY/SELL
      size,
      contracts: size,          // удобный алиас для фронта
      pnl: pnl$,
      fee: fee$ ?? 0,
      openPrice,
      closePrice,
      openDate: openDate || null,
      closeDate,
      createdAt: closeDate,     // фронт сортирует/показывает по createdAt
      isProfit: pnl$ >= 0,
      netR: null,               // R считаем позже, после ввода SL
      pricePerPoint: pricePerPoint ?? undefined,
      source: "volfix",
      externalKey: openOrderId || null, // ключ = openOrderId
      openOrderId,
      closeOrderId,
    };

    // новые метрики
    if (typeof pipsVal === "number") baseDoc.pips = pipsVal;
    if (typeof ddPts   === "number") baseDoc.drawdown = ddPts;
    if (typeof ddCash  === "number") baseDoc.drawdownCash = ddCash;

    if (sample.length < 3) sample.push({ ...baseDoc, userId: String(userId) });

    // честный dry-run: дубликат в рамках текущего файла
    if (baseDoc.externalKey) {
      if (seenInBatch.has(baseDoc.externalKey)) {
        reasons.duplicateInFile++; skipped++; continue;
      }
      seenInBatch.add(baseDoc.externalKey);
    }

    // проверка дублей/обновлений в БД (с бэк-совместимостью)
    if (baseDoc.externalKey) {
      const oldPairKey = (openOrderId || closeOrderId) ? `${openOrderId}|${closeOrderId}` : null;
      const exists = await col.findOne({
        userId,
        $or: [
          { externalKey: baseDoc.externalKey },                    // новый ключ (open)
          oldPairKey ? { externalKey: oldPairKey } : { _id: null },// старый ключ (open|close)
          openOrderId ? { openOrderId: openOrderId } : { _id: null }
        ]
      });

      if (exists) {
        if (updateMode && !dryRun) {
          const $set = {};
          for (const [k, v] of Object.entries(baseDoc)) {
            if (v !== undefined) $set[k] = v;
          }
          // миграция ключа
          if (openOrderId) $set.externalKey = openOrderId;
          await col.updateOne({ _id: exists._id }, { $set });
          updated++;
          continue;
        }
        reasons.duplicate++; skipped++; continue;
      }
    }

    if (!dryRun) {
      await col.insertOne(baseDoc);
    }
    imported++;
  }

  const payload = { ok: true, imported, updated, skipped, reasons, sample };
  if (dryRun && debugBadCloseDate.size) {
    payload.debug = {
      badCloseDateSamples: Array.from(debugBadCloseDate).slice(0, 10),
      hint: "Формат этих дат не распознан. Поддерживаются dd.MM.yy(yy), dd/MM/yy(yy), yyyy-MM-dd (c/без секунд).",
    };
  }
  return res.json(payload);
}

export default router;
