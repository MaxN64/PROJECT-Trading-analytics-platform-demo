import multer from "multer";

export default function errorHandler(err, _req, res, _next) {
  console.error("ERROR:", err && err.stack ? err.stack : err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err?.message || "Internal error" });
}
