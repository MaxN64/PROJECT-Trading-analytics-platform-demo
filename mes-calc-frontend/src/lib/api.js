/* ------------------------------------------------------------------ */
/*                     Базовый URL для CRA / Vite                     */
/* ------------------------------------------------------------------ */
const BASE =
  (typeof window !== "undefined" && window.APP_CONFIG && window.APP_CONFIG.apiBase) ||
  process.env.REACT_APP_API_URL ||
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  // важно: localhost, а не 127.0.0.1 — чтобы совпали куки домена
  "http://localhost:3001";

/* ------------------------------------------------------------------ */
/*                           helper: fetch                            */
/* ------------------------------------------------------------------ */
async function req(path, { method = "GET", body, headers } = {}) {
  const hdrs = { ...(headers || {}) };
  if (!(body instanceof FormData)) hdrs["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: hdrs,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  if (res.status === 204) return null;

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  return ct.includes("application/json") ? res.json() : res.text();
}

/* ------------------------------------------------------------------ */
/*                            trades (REST)                           */
/* ------------------------------------------------------------------ */
export async function listTrades(query = {}) {
  const qs = new URLSearchParams(query).toString();
  return req(`/api/trades${qs ? `?${qs}` : ""}`);
}
export async function createTrade(payload) {
  return req(`/api/trades`, { method: "POST", body: payload });
}
export async function updateTrade(id, patch) {
  return req(`/api/trades/${id}`, { method: "PATCH", body: patch });
}
export async function deleteTrade(id) {
  return req(`/api/trades/${id}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/*                       attachments (GridFS)                         */
/* ------------------------------------------------------------------ */
export function uploadAttachment(tradeId, file, metaOrCb, maybeCb) {
  let meta = {};
  let onProgress = null;

  if (typeof metaOrCb === "function") onProgress = metaOrCb;
  else if (metaOrCb && typeof metaOrCb === "object") meta = metaOrCb;
  if (typeof maybeCb === "function") onProgress = maybeCb;

  const declaredKind = (meta.kind || "").toLowerCase();
  let kind =
    declaredKind === "audio" || declaredKind === "image" || declaredKind === "file"
      ? declaredKind
      : file?.type?.startsWith("audio/")
      ? "audio"
      : file?.type?.startsWith("image/")
      ? "image"
      : "file";

  const url =
    kind === "audio"
      ? `${BASE}/api/trades/${tradeId}/attachments/audio`
      : kind === "image"
      ? `${BASE}/api/trades/${tradeId}/attachments/images`
      : `${BASE}/api/trades/${tradeId}/attachments`;

  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file, meta.name || file?.name || "file");
    Object.entries(meta).forEach(([k, v]) => {
      if (v !== undefined && v !== null && k !== "onProgress") fd.append(k, String(v));
    });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.withCredentials = true;
    xhr.responseType = "json";

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (ok) resolve(xhr.response);
      else {
        const msg =
          (xhr.response && (xhr.response.error || xhr.response.message)) ||
          xhr.responseText ||
          `HTTP ${xhr.status}`;
        reject(new Error(`Upload failed: ${msg}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(fd);
  });
}

/** Удалить КОНКРЕТНОЕ фото по fileId (и из GridFS, и из сделки) */
export async function deleteImage(tradeId, fileId) {
  return req(`/api/trades/${tradeId}/attachments/images/${fileId}`, { method: "DELETE" });
}

/** Удалить голосовую заметку у сделки (и файл, и ссылку) */
export async function deleteVoice(tradeId) {
  return req(`/api/trades/${tradeId}/voice`, { method: "DELETE" });
}

/** Преобразование dataURL -> Blob (для сохранения картинок/аудио) */
export function dataUrlToBlob(dataUrl) {
  const [meta, base64] = String(dataUrl).split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "application/octet-stream";
  const bin = atob(base64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* ------------------------------------------------------------------ */
/*                              helpers                               */
/* ------------------------------------------------------------------ */
export const streamImageUrl = (id) => `${BASE}/api/attachments/images/${id}`;
export const streamAudioUrl = (id) => `${BASE}/api/attachments/audio/${id}`;
export const streamUrl = (id, kind) =>
  kind === "audio"
    ? streamAudioUrl(id)
    : kind === "image"
    ? streamImageUrl(id)
    : `${BASE}/api/attachments/stream/${id}`;

/* ------------------------------------------------------------------ */
/*                       VolFix CSV import (frontend)                 */
/* ------------------------------------------------------------------ */
function _toNum(x) {
  return Number(String(x ?? "").replace(",", "."));
}

export async function importVolfixCsv({ file, instrument, tickSize, tickValue, dry = false, update = false }) {
  if (!file) throw new Error("Файл CSV не выбран");

  const qs = new URLSearchParams({
    instrument: String(instrument || "ES").toUpperCase(),
    tickSize: String(_toNum(tickSize)),
    tickValue: String(_toNum(tickValue)),
  });
  if (dry) qs.set("dry", "1");
  if (update) qs.set("update", "1");

  const fd = new FormData();
  // ВАЖНО: имя поля именно "file" — так ждёт сервер
  fd.append("file", file, file.name || "volfix.csv");

  return req(`/api/integrations/volfix/import?${qs.toString()}`, {
    method: "POST",
    body: fd,
  });
}

/* ------------------------------------------------------------------ */
/*                Batch-сохранение метрик уровня (VJ)                 */
/* ------------------------------------------------------------------ */
export async function saveVjMetricsBatch({ dateKey, mode, items }) {
  // items: [{ id, index, fields: {...} }]
  return req(`/api/trades/batch-metrics`, {
    method: "POST",
    body: { dateKey, mode, items },
  });
}

/* ------------------------------------------------------------------ */
/*                VJ days (персист в БД, /api/vj/*)                   */
/* ------------------------------------------------------------------ */
export async function vjListDays({ instrument }) {
  const qs = new URLSearchParams({ instrument: String(instrument || "ES").toUpperCase() }).toString();
  return req(`/api/vj?${qs}`);
}
export async function vjGetDay({ day, instrument }) {
  const qs = new URLSearchParams({ instrument: String(instrument || "ES").toUpperCase() }).toString();
  return req(`/api/vj/${day}?${qs}`);
}
export async function vjUpsertDay({ day, instrument, rows, tickSize = 0.25, source = "volfix" }) {
  return req(`/api/vj/${day}`, {
    method: "POST",
    body: { instrument: String(instrument || "ES").toUpperCase(), rows, tickSize, source },
  });
}

/* ------------------------------------------------------------------ */
/*                              routes map                            */
/* ------------------------------------------------------------------ */
export const routes = {
  list: `${BASE}/api/trades`,
  create: `${BASE}/api/trades`,
  byId: (id) => `${BASE}/api/trades/${id}`,
  uploadAny: (id) => `${BASE}/api/trades/${id}/attachments`,
  uploadImage: (id) => `${BASE}/api/trades/${id}/attachments/images`,
  uploadAudio: (id) => `${BASE}/api/trades/${id}/attachments/audio`,
  streamAny: (id) => `${BASE}/api/attachments/stream/${id}`,
  streamImage: (id) => `${BASE}/api/attachments/images/${id}`,
  streamAudio: (id) => `${BASE}/api/attachments/audio/${id}`,
  saveMetricsBatch: `${BASE}/api/trades/batch-metrics`,
  vjListDays: (instrument) => `${BASE}/api/vj?instrument=${encodeURIComponent(instrument)}`,
  vjGetDay: (day, instrument) => `${BASE}/api/vj/${day}?instrument=${encodeURIComponent(instrument)}`,
};

/* ------------------------------------------------------------------ */
/*                             default export                         */
/* ------------------------------------------------------------------ */
const api = {
  listTrades,
  createTrade,
  updateTrade,
  deleteTrade,
  uploadAttachment,
  deleteImage,
  deleteVoice,
  dataUrlToBlob,
  streamUrl,
  streamImageUrl,
  streamAudioUrl,
  routes,
  importVolfixCsv,
  saveVjMetricsBatch,
  vjListDays,
  vjGetDay,
  vjUpsertDay,
};
export default api;
