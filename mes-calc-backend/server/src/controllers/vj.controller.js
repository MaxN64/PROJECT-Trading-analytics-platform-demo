// server/src/controllers/vj.controller.js
import VJDay from "../models/VJDay.js";

function buildProfile(rows, tick = 0.25) {
  const map = new Map();
  for (const r of rows) {
    const p = +Number(r.price).toFixed(2);
    map.set(p, (map.get(p) || 0) + (r.volume || 0));
  }
  const arr = Array.from(map, ([price, volume]) => ({ price, volume })).sort((a, b) => a.price - b.price);
  if (!arr.length) return { POC: 0, VAL: 0, VAH: 0, total: 0, levelsCount: 0 };

  let pocIdx = 0;
  for (let i = 1; i < arr.length; i += 1) if (arr[i].volume > arr[pocIdx].volume) pocIdx = i;
  const POC = arr[pocIdx].price;

  const total = arr.reduce((s, r) => s + r.volume, 0);
  const target = 0.7 * total;
  let cum = arr[pocIdx].volume;
  let L = pocIdx - 1;
  let R = pocIdx + 1;
  let VAL = POC;
  let VAH = POC;

  while (cum < target && (L >= 0 || R < arr.length)) {
    const vL = L >= 0 ? arr[L].volume : -1;
    const vR = R < arr.length ? arr[R].volume : -1;
    if (vL > vR) {
      cum += vL;
      VAL = arr[L].price;
      L -= 1;
    } else if (vR > vL) {
      cum += vR;
      VAH = arr[R].price;
      R += 1;
    } else {
      if (L >= 0) {
        cum += vL;
        VAL = arr[L].price;
        L -= 1;
      }
      if (cum >= target) break;
      if (R < arr.length) {
        cum += vR;
        VAH = arr[R].price;
        R += 1;
      }
    }
  }
  return { POC, VAL, VAH, total, levelsCount: arr.length };
}

function mergeRows(rows) {
  const m = new Map();
  for (const r of rows) {
    const p = +Number(r.price).toFixed(2);
    const prev = m.get(p) || { price: p, volume: 0, deltaAgg: 0 };
    prev.volume += Number(r.volume || 0);
    prev.deltaAgg += Number(r.deltaAgg || 0);
    m.set(p, prev);
  }
  return Array.from(m.values()).sort((a, b) => a.price - b.price);
}

export async function upsertDay(req, res, next) {
  try {
    const userId = req.user?._id || req.userId || req.body.userId;
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const day = String(req.params.day);
    const { instrument, rows = [], tickSize = 0.25, source = "volfix" } = req.body || {};
    if (!day || !instrument) return res.status(400).json({ error: "day and instrument required" });

    const merged = mergeRows(rows);
    const profile = buildProfile(merged, tickSize);

    const doc = await VJDay.findOneAndUpdate(
      { userId, instrument, day },
      { $set: { instrument, day, tickSize, source, rows: merged, profile } },
      { new: true, upsert: true }
    );

    res.json({ ok: true, day: doc.day, instrument: doc.instrument, profile: doc.profile, rowsCount: doc.rows.length });
  } catch (e) {
    next(e);
  }
}

export async function getDay(req, res, next) {
  try {
    const userId = req.user?._id || req.userId || req.query.userId;
    const day = String(req.params.day);
    const instrument = String(req.query.instrument || "");
    if (!userId || !day || !instrument) return res.status(400).json({ error: "userId, day, instrument required" });

    const doc = await VJDay.findOne({ userId, instrument, day }).lean();
    if (!doc) return res.status(404).json({ error: "not found" });
    res.json({ day: doc.day, instrument: doc.instrument, rows: doc.rows, profile: doc.profile });
  } catch (e) {
    next(e);
  }
}

export async function listDays(req, res, next) {
  try {
    const userId = req.user?._id || req.userId || req.query.userId;
    const instrument = String(req.query.instrument || "");
    if (!userId || !instrument) return res.status(400).json({ error: "userId & instrument required" });

    const docs = await VJDay.find({ userId, instrument }).sort({ day: 1 }).lean();
    res.json(
      docs.map((d) => ({
        day: d.day,
        instrument: d.instrument,
        rowsCount: (d.rows || []).length,
        profile: d.profile || {},
        updatedAt: d.updatedAt,
      }))
    );
  } catch (e) {
    next(e);
  }
}
