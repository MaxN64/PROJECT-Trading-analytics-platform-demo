let API_BASE = "http://localhost:3001/api";
let USER_ID = "000000000000000000000001";

export function setApiBase(url) {
  API_BASE = url.replace(/\/$/, "") + "/api";
}
export function setUserId(id) {
  USER_ID = id;
}

function authHeaders() {
  return { "x-user-id": USER_ID };
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) v.forEach(x => sp.append(k, x));
    else sp.set(k, v);
  });
  return sp.toString();
}

/* -------- Trades -------- */
export async function listTrades(filter = {}) {
  const r = await fetch(`${API_BASE}/trades?${qs(filter)}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createTrade(data) {
  const r = await fetch(`${API_BASE}/trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateTrade(id, patch) {
  const r = await fetch(`${API_BASE}/trades/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteTrade(id) {
  const r = await fetch(`${API_BASE}/trades/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* -------- Attachments -------- */
export async function uploadAttachment(tradeId, file, meta = { kind: "image" }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", meta.kind || "image");
  if (meta.name) fd.append("name", meta.name);
  if (meta.durationMs != null) fd.append("durationMs", String(meta.durationMs));
  const r = await fetch(`${API_BASE}/trades/${tradeId}/attachments`, {
    method: "POST",
    headers: authHeaders(),
    body: fd
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function streamUrl(attachmentId) {
  return `${API_BASE}/attachments/stream/${attachmentId}`;
}

export async function deleteImage(tradeId, fileId) {
  const r = await fetch(`${API_BASE}/trades/${tradeId}/attachments/images/${fileId}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteVoice(tradeId) {
  const r = await fetch(`${API_BASE}/trades/${tradeId}/voice`, {
    method: "DELETE",
    headers: authHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* helpers */
export function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*);base64/) || [])[1] || "application/octet-stream";
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}
