// server/scripts/cleanup-orphans.js
import dotenv from "dotenv";
dotenv.config();

import mongoose, { Types as MongoTypes } from "mongoose";
import { connectDB, closeDB, deleteFromAnyBucket } from "../src/db.js";
import Trade from "../src/models/Trade.js";

async function main() {
  await connectDB();

  // Собираем все используемые id из сделок
  const trades = await Trade.find({}, { screenshotId: 1, voiceNoteId: 1 }).lean();
  const used = new Set(
    trades.flatMap((t) => [t.screenshotId, t.voiceNoteId])
      .filter(Boolean)
      .map((x) => String(x))
  );

  // Пройдём по обоим бакетам
  const db = mongoose.connection.db;
  const buckets = ["images", "audio"];

  let removed = 0;

  for (const name of buckets) {
    const filesColl = db.collection(`${name}.files`);
    const cursor = filesColl.find({}, { projection: { _id: 1 } });

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const idStr = String(doc._id);
      if (!used.has(idStr)) {
        await deleteFromAnyBucket(doc._id);
        removed++;
      }
    }
  }

  console.log(`Cleanup done. Removed orphans: ${removed}`);
  await closeDB();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
