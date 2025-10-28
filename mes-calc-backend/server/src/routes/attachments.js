// server/src/routes/attachments.js
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { Readable } from "stream";

import { getBucket, openDownloadStreamAny, deleteFromAnyBucket } from "../db.js";
import Trade from "../models/Trade.js";
import Attachment from "../models/Attachment.js";

const router = express.Router();

/** В db.js бакеты создаются как: images / audio */
const IMAGE_BUCKET = "images";
const AUDIO_BUCKET = "audio";

/* --------------------------- multer (memory) --------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/* ------------------------------ helpers ------------------------------- */
const asId = (v) => {
  try { return new mongoose.Types.ObjectId(String(v)); }
  catch { return null; }
};

const userIdFromReq = (req) =>
  req.user?.id || req.user?._id || req.headers["x-user-id"] || "000000000000000000000001";

const isImage = (m) => typeof m === "string" && m.startsWith("image/");
const isAudio = (m) => typeof m === "string" && m.startsWith("audio/");

const safeName = (name) => {
  const base = String(name || "file").trim();
  try {
    return base.replace(/[^\p{L}\p{N}.\-_\s]/gu, "").slice(0, 128) || "file";
  } catch {
    return base.replace(/[^a-zA-Z0-9.\-_\s]/g, "").slice(0, 128) || "file";
  }
};

async function storeToGridFS(file, bucketName) {
  const bucket = getBucket(bucketName); // audio → audioBucket, иначе imagesBucket
  return await new Promise((resolve, reject) => {
    const up = bucket.openUploadStream(safeName(file.originalname || "file"), {
      contentType: file.mimetype,
    });
    Readable.from(file.buffer).pipe(up);
    up.on("finish", () => resolve(up.id));
    up.on("error", reject);
  });
}

// принадлежит ли файл пользователю (через любую привязку в Trade)
async function ensureOwnedFile(userId, fileId) {
  return await Trade.findOne(
    {
      userId: asId(userId),
      $or: [{ images: fileId }, { voiceNoteId: fileId }, { screenshotId: fileId }],
    },
    { _id: 1 }
  ).lean();
}

function pipeFound(res, found) {
  const { stream, file } = found;
  res.setHeader("Content-Type", file?.contentType || "application/octet-stream");
  if (file?.length) res.setHeader("Content-Length", file.length);
  res.setHeader("Cache-Control", "private, max-age=0");
  stream.on("error", (err) => res.status(500).end(String(err)));
  stream.pipe(res);
}

// уникальное количество фото (images ∪ screenshotId)
function uniqueImageCount(trade) {
  const set = new Set((Array.isArray(trade.images) ? trade.images : []).map(String));
  if (trade.screenshotId) set.add(String(trade.screenshotId));
  return set.size;
}

/* ====================================================================== */
/*                                  UPLOAD                                */
/* ====================================================================== */

/** Универсальный (legacy) аплоад: определяем тип по mimetype */
router.post("/trades/:tradeId/attachments", upload.single("file"), async (req, res, next) => {
  try {
    const tradeId = asId(req.params.tradeId);
    if (!tradeId) return res.status(400).json({ error: "Invalid tradeId" });

    const userId = asId(userIdFromReq(req));
    const trade = await Trade.findOne(
      { _id: tradeId, userId },
      { images: 1, screenshotId: 1, voiceNoteId: 1 }
    ).lean();
    if (!trade) return res.status(404).json({ error: "Trade not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file" });

    const kind = isAudio(file.mimetype) ? "audio" : isImage(file.mimetype) ? "image" : "file";
    if (kind === "file") return res.status(400).json({ error: "Only image/audio allowed" });

    if (kind === "image" && uniqueImageCount(trade) >= 4) {
      return res.status(400).json({ error: "Max 4 images per trade" });
    }

    const bucketName = kind === "audio" ? AUDIO_BUCKET : IMAGE_BUCKET;
    const gfsId = await storeToGridFS(file, bucketName);

    await Attachment.create({
      userId,
      tradeId,
      kind,
      mimeType: file.mimetype,
      size: file.size,
      durationMs: req.body?.durationMs ? Number(req.body.durationMs) : undefined,
      fileId: gfsId,
      name: file.originalname,
    });

    if (kind === "image") {
      // переносим legacy screenshotId в массив при первой же загрузке
      const legacyInImages =
        trade.screenshotId &&
        Array.isArray(trade.images) &&
        trade.images.some((x) => String(x) === String(trade.screenshotId));

      const pushList =
        trade.screenshotId && !legacyInImages
          ? [trade.screenshotId, gfsId]
          : [gfsId];

      const update = {
        $push: { images: { $each: pushList, $slice: -4 } },
      };
      if (trade.screenshotId && !legacyInImages) update.$unset = { screenshotId: "" };
      await Trade.updateOne({ _id: tradeId }, update);
    } else {
      if (trade.voiceNoteId) { try { await deleteFromAnyBucket(trade.voiceNoteId); } catch {} }
      await Trade.updateOne({ _id: tradeId }, { $set: { voiceNoteId: gfsId } });
    }

    res.json({ ok: true, fileId: gfsId, kind });
  } catch (e) {
    next(e);
  }
});

/** Явный URL: картинки */
router.post("/trades/:tradeId/attachments/images", upload.single("file"), async (req, res, next) => {
  try {
    const tradeId = asId(req.params.tradeId);
    if (!tradeId) return res.status(400).json({ error: "Invalid tradeId" });

    const userId = asId(userIdFromReq(req));
    const trade = await Trade.findOne(
      { _id: tradeId, userId },
      { images: 1, screenshotId: 1 }
    ).lean();
    if (!trade) return res.status(404).json({ error: "Trade not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file" });
    if (!isImage(file.mimetype)) return res.status(400).json({ error: "Only images allowed" });

    if (uniqueImageCount(trade) >= 4) {
      return res.status(400).json({ error: "Max 4 images per trade" });
    }

    const gfsId = await storeToGridFS(file, IMAGE_BUCKET);

    await Attachment.create({
      userId,
      tradeId,
      kind: "image",
      mimeType: file.mimetype,
      size: file.size,
      fileId: gfsId,
      name: file.originalname,
    });

    // перенос legacy при необходимости
    const legacyInImages =
      trade.screenshotId &&
      Array.isArray(trade.images) &&
      trade.images.some((x) => String(x) === String(trade.screenshotId));

    const pushList =
      trade.screenshotId && !legacyInImages
        ? [trade.screenshotId, gfsId]
        : [gfsId];

    const update = {
      $push: { images: { $each: pushList, $slice: -4 } },
    };
    if (trade.screenshotId && !legacyInImages) update.$unset = { screenshotId: "" };
    await Trade.updateOne({ _id: tradeId }, update);

    res.json({ ok: true, fileId: gfsId });
  } catch (e) {
    next(e);
  }
});

/** Явный URL: аудио */
router.post("/trades/:tradeId/attachments/audio", upload.single("file"), async (req, res, next) => {
  try {
    const tradeId = asId(req.params.tradeId);
    if (!tradeId) return res.status(400).json({ error: "Invalid tradeId" });

    const userId = asId(userIdFromReq(req));
    const trade = await Trade.findOne(
      { _id: tradeId, userId },
      { voiceNoteId: 1 }
    ).lean();
    if (!trade) return res.status(404).json({ error: "Trade not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file" });
    if (!isAudio(file.mimetype)) return res.status(400).json({ error: "Only audio allowed" });

    const gfsId = await storeToGridFS(file, AUDIO_BUCKET);

    await Attachment.create({
      userId,
      tradeId,
      kind: "audio",
      mimeType: file.mimetype,
      size: file.size,
      durationMs: req.body?.durationMs ? Number(req.body.durationMs) : undefined,
      fileId: gfsId,
      name: file.originalname,
    });

    if (trade.voiceNoteId) { try { await deleteFromAnyBucket(trade.voiceNoteId); } catch {} }
    await Trade.updateOne({ _id: tradeId }, { $set: { voiceNoteId: gfsId } });

    res.json({ ok: true, fileId: gfsId });
  } catch (e) {
    next(e);
  }
});

/* ====================================================================== */
/*                                  DELETE                                */
/* ====================================================================== */

/** Удалить конкретное фото (поддержка legacy screenshotId) */
router.delete("/trades/:tradeId/attachments/images/:fileId", async (req, res, next) => {
  try {
    const tradeId = asId(req.params.tradeId);
    const fileId  = asId(req.params.fileId);
    if (!tradeId || !fileId) return res.status(400).json({ error: "Invalid id" });

    const userId = asId(userIdFromReq(req));
    const trade = await Trade.findOne(
      { _id: tradeId, userId },
      { images: 1, screenshotId: 1 }
    ).lean();
    if (!trade) return res.status(404).json({ error: "Not found" });

    const inImages =
      Array.isArray(trade.images) &&
      trade.images.some((x) => String(x) === String(fileId));
    const isLegacy =
      trade.screenshotId && String(trade.screenshotId) === String(fileId);

    if (!inImages && !isLegacy) {
      return res.status(404).json({ error: "Not found" });
    }

    const update = {};
    if (inImages) update.$pull = { images: fileId };
    if (isLegacy) update.$unset = { ...(update.$unset || {}), screenshotId: "" };

    await Trade.updateOne({ _id: tradeId }, update);

    try { await deleteFromAnyBucket(fileId); } catch {}
    await Attachment.deleteOne({ fileId });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/** Удалить голосовую заметку */
router.delete("/trades/:tradeId/voice", async (req, res, next) => {
  try {
    const tradeId = asId(req.params.tradeId);
    if (!tradeId) return res.status(400).json({ error: "Invalid tradeId" });

    const userId = asId(userIdFromReq(req));
    const trade = await Trade.findOne(
      { _id: tradeId, userId },
      { voiceNoteId: 1 }
    ).lean();

    if (!trade?.voiceNoteId) return res.status(404).json({ error: "Not found" });

    const vid = trade.voiceNoteId;
    try { await deleteFromAnyBucket(vid); } catch {}
    await Trade.updateOne({ _id: tradeId }, { $unset: { voiceNoteId: "" } });
    await Attachment.deleteOne({ fileId: vid });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/* ====================================================================== */
/*                                  STREAM                                */
/* ====================================================================== */

router.get("/attachments/:id", async (req, res, next) => {
  try {
    const fileId = asId(req.params.id);
    if (!fileId) return res.status(400).end("Invalid id");

    const owned = await ensureOwnedFile(userIdFromReq(req), fileId);
    if (!owned) return res.status(404).end("Not found");

    const found = await openDownloadStreamAny(fileId);
    if (!found) return res.status(404).end("Not found");

    pipeFound(res, found);
  } catch (e) { next(e); }
});

// совместимый путь с вашим client-sdk
router.get("/attachments/stream/:id", async (req, res, next) => {
  try {
    const fileId = asId(req.params.id);
    if (!fileId) return res.status(400).end("Invalid id");

    const owned = await ensureOwnedFile(userIdFromReq(req), fileId);
    if (!owned) return res.status(404).end("Not found");

    const found = await openDownloadStreamAny(fileId);
    if (!found) return res.status(404).end("Not found");

    pipeFound(res, found);
  } catch (e) { next(e); }
});

router.get("/attachments/images/:id", async (req, res, next) => {
  try {
    const fileId = asId(req.params.id);
    if (!fileId) return res.status(400).end("Invalid id");

    const owned = await ensureOwnedFile(userIdFromReq(req), fileId);
    if (!owned) return res.status(404).end("Not found");

    const found = await openDownloadStreamAny(fileId);
    if (!found) return res.status(404).end("Not found");
    pipeFound(res, found);
  } catch (e) { next(e); }
});

router.get("/attachments/audio/:id", async (req, res, next) => {
  try {
    const fileId = asId(req.params.id);
    if (!fileId) return res.status(400).end("Invalid id");

    const owned = await ensureOwnedFile(userIdFromReq(req), fileId);
    if (!owned) return res.status(404).end("Not found");

    const found = await openDownloadStreamAny(fileId);
    if (!found) return res.status(404).end("Not found");
    pipeFound(res, found);
  } catch (e) { next(e); }
});

export default router;
