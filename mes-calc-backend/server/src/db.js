// server/src/db.js
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

let conn;
let imagesBucket;
let audioBucket;

export async function connectDB() {
  if (conn) return conn;
  conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  imagesBucket = new GridFSBucket(mongoose.connection.db, { bucketName: "images" });
  audioBucket  = new GridFSBucket(mongoose.connection.db,  { bucketName: "audio" });

  console.log("MongoDB connected, GridFS buckets ready: images, audio");
  return mongoose.connection;
}

/** 👉 Вернуть нативный db (нужен маршрутам, которые работают через native driver) */
export function getDb() {
  const db = mongoose.connection?.db;
  if (!db) {
    throw new Error("DB is not initialized. Call connectDB() on server start.");
  }
  return db;
}

/** Получить бакет по типу */
export function getBucket(kind = "image") {
  return kind === "audio" ? audioBucket : imagesBucket;
}

/** Аккуратно закрыть соединение (для тестов/скриптов) */
export async function closeDB() {
  if (!conn) return;
  await mongoose.disconnect();
  conn = undefined;
  imagesBucket = undefined;
  audioBucket = undefined;
  console.log("MongoDB disconnected");
}

/** Найти файл в одном из бакетов по _id — возвращает {bucketName, file} или null */
export async function findFileInAnyBucket(objectId) {
  const db = mongoose.connection.db;
  const img = await db.collection("images.files").findOne({ _id: objectId });
  if (img) return { bucketName: "images", file: img };
  const aud = await db.collection("audio.files").findOne({ _id: objectId });
  if (aud) return { bucketName: "audio", file: aud };
  return null;
}

/** Открыть поток скачивания по _id, сам определит нужный бакет */
export async function openDownloadStreamAny(objectId) {
  const found = await findFileInAnyBucket(objectId);
  if (!found) return null;
  const bucket = found.bucketName === "audio" ? audioBucket : imagesBucket;
  return { stream: bucket.openDownloadStream(objectId), file: found.file, bucketName: found.bucketName };
}

/** Удалить файл по _id, сам определит бакет */
export async function deleteFromAnyBucket(objectId) {
  const found = await findFileInAnyBucket(objectId);
  if (!found) return false;
  const bucket = found.bucketName === "audio" ? audioBucket : imagesBucket;
  await bucket.delete(objectId);
  return true;
}
