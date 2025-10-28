import express from "express";
import Trade from "../models/Trade.js";
import mongoose from "mongoose";

const router = express.Router();

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// список разрешенных полей для обычного PATCH /:id
const ALLOWED_PATCH_FIELDS = [
  "isProfit",
  "stopPoints",
  "pricePerPoint",
  "perContractRisk",
  "contracts",
  "totalRisk",
  "conditions",
  "conditionsLabels",
  "tags",
  "comment",

  // позволяем менять метрики и одиночным PATCH, если нужно
  "vj_in_value_area",
  "vj_va_edge_dist_ticks",
  "vj_is_HVN",
  "vj_is_LVN",
  "vj_vol_pctile",
  "vj_delta_agg",
  "vj_delta_rank",
  "vj_delta_opposes_side",
  "vj_edge_slope",
  "vj_thin_behind",
  "vj_vol_es_equiv",
  "vj_p70_es",
  "vj_poc",
  "vj_val",
  "vj_vah",
  "vj_level_score",
  "vj_flags",
  "vj_calc_date",
  "vj_apply_mode",
];

const METRIC_FIELDS = new Set([
  "vj_in_value_area",
  "vj_va_edge_dist_ticks",
  "vj_is_HVN",
  "vj_is_LVN",
  "vj_vol_pctile",
  "vj_delta_agg",
  "vj_delta_rank",
  "vj_delta_opposes_side",
  "vj_edge_slope",
  "vj_thin_behind",
  "vj_vol_es_equiv",
  "vj_p70_es",
  "vj_poc",
  "vj_val",
  "vj_vah",
  "vj_level_score",
  "vj_flags",
  "vj_calc_date",
  "vj_apply_mode",
]);

/* ===================== GET /api/trades ===================== */
// ?dateFrom=&dateTo=&hourFrom=&hourTo=&outcome=all|win|loss&conditions=&tags=&matchAll=&limit=&skip=
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { dateFrom, dateTo, hourFrom, hourTo, outcome, matchAll } = req.query;

    let limit = parseInt(req.query.limit ?? "200", 10);
    let skip  = parseInt(req.query.skip  ?? "0",   10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 200;
    if (!Number.isFinite(skip)  || skip  < 0)   skip  = 0;
    if (limit > 500) limit = 500;

    const q = { userId };

    if (dateFrom || dateTo) {
      q.createdAt = {};
      if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
      if (dateTo)   q.createdAt.$lte = new Date(dateTo);
    }

    if (
      hourFrom !== undefined && hourFrom !== "" &&
      hourTo   !== undefined && hourTo   !== ""
    ) {
      q.localHour = { $gte: Number(hourFrom), $lte: Number(hourTo) };
    }

    if (outcome === "win")  q.isProfit = true;
    if (outcome === "loss") q.isProfit = false;

    const conditions = toArray(req.query.conditions);
    if (conditions.length) {
      q.conditions = matchAll === "true" ? { $all: conditions } : { $in: conditions };
    }

    const tags = toArray(req.query.tags);
    if (tags.length) q.tags = { $all: tags };

    const items = await Trade.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(items);
  } catch (e) {
    next(e);
  }
});

/* ===================== POST /api/trades ===================== */
router.post("/", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const body = req.body || {};
    const dt = new Date(body.createdAt || Date.now());

    const nyHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/New_York",
      }).format(dt)
    );

    const localHour = dt.getHours();

    const trade = await Trade.create({
      ...body,
      userId,
      createdAt: dt,
      localHour,
      nyHour,
    });

    res.status(201).json(trade);
  } catch (e) {
    next(e);
  }
});

/* ================== PATCH /api/trades/:id =================== */
router.patch("/:id", async (req, res, next) => {
  try {
    const body = req.body || {};
    const patch = {};
    for (const k of ALLOWED_PATCH_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        patch[k] = body[k];
      }
    }

    const trade = await Trade.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      patch,
      { new: true, runValidators: true }
    );
    if (!trade) return res.sendStatus(404);
    res.json(trade);
  } catch (e) {
    next(e);
  }
});

/* =========== POST /api/trades/batch-metrics =================
   Сохранение метрик за день одним запросом.
   Body:
   {
     "dateKey": "2025-09-12",
     "mode": "FADE" | "BREAKOUT",
     "items": [
       { "id": "...", "patch": { <subset of METRIC_FIELDS> } },
       ...
     ]
   }
================================================================ */
router.post("/batch-metrics", async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { dateKey, mode, items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items required" });
    }

    let modified = 0;
    for (const it of items) {
      if (!it || !it.id) continue;

      // фильтруем только разрешённые метрики
      const set = { vj_calc_date: dateKey, vj_apply_mode: mode };
      const patch = it.patch || {};
      for (const k of Object.keys(patch)) {
        if (METRIC_FIELDS.has(k)) set[k] = patch[k];
      }

      const r = await Trade.updateOne(
        { _id: it.id, userId },
        { $set: set }
      );
      modified += r.modifiedCount || 0;
    }

    res.json({ ok: true, modified });
  } catch (e) {
    next(e);
  }
});

/* ================= DELETE /api/trades/:id =================== */
router.delete("/:id", async (req, res, next) => {
  try {
    const t = await Trade.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!t) return res.sendStatus(404);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ===== отладка изображений (как у вас было) ===== */
router.get("/:id/debug/images", async (req, res, next) => {
  try {
    const t = await Trade.findOne(
      { _id: req.params.id, userId: req.user._id },
      { images: 1, screenshotId: 1 }
    ).lean();
    if (!t) return res.status(404).json({ error: "Not found" });

    res.json({
      images: (t.images || []).map(String),
      screenshotId: t.screenshotId ? String(t.screenshotId) : null,
      uniqueCount: new Set([...(t.images || []).map(String), t.screenshotId && String(t.screenshotId)].filter(Boolean)).size
    });
  } catch (e) { next(e); }
});

export default router;
