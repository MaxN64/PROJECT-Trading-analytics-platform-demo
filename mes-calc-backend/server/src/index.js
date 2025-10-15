// mes-calc-backend/server/src/index.js
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import { connectDB } from "./db.js";
import { attachUser } from "./middleware/auth.js";

import trades from "./routes/trades.js";
import attachments from "./routes/attachments.js";
import volfix from "./routes/volfix.js";
import vjRoutes from "./routes/vj.routes.js";

import errorHandler from "./middleware/error.js";

dotenv.config();
await connectDB();

// индексы
try {
  const db = mongoose.connection.db;
  await Promise.all([
    db.collection("trades").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("trades").createIndex({ userId: 1, externalKey: 1 }, { unique: true, sparse: true }),
    db.collection("trades").createIndex({ userId: 1, netR: 1 }),
  ]);
  console.log("MongoDB indexes ensured for 'trades'.");
} catch (e) {
  console.error("Failed to ensure indexes:", e);
}

const app = express();

const PORT = process.env.PORT || 3001;
// ⚠️ важно: localhost, чтобы куки совпадали с фронтом
const HOST = process.env.HOST || "localhost";

const FRONTEND_DIST = process.env.FRONTEND_DIST || "";
const DEV_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:${process.env.FRONTEND_DEV_PORT || 3000}`;

app.use(
  cors({
    origin: FRONTEND_DIST ? true : DEV_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// 🔐 сначала навешиваем пользователя (кука/токен)
app.use(attachUser);

// -------- API routes (теперь все получают req.user) --------
app.use("/api/vj", vjRoutes);
app.use("/api/trades", trades);
app.use("/api", attachments); // /api/trades/:id/attachments* и /api/attachments/*
app.use("/api", volfix);     // интеграция VolFix

// health
app.get("/health", (_req, res) => res.json({ ok: true }));

// prod статика (для Electron/сборки)
if (FRONTEND_DIST) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// обработчик ошибок должен быть последним
app.use(errorHandler);

app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
  if (FRONTEND_DIST) console.log(`Serving frontend from: ${FRONTEND_DIST}`);
});
