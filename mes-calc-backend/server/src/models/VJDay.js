// server/src/models/VJDay.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const VJRow = new Schema(
  {
    price: { type: Number, required: true },
    volume: { type: Number, default: 0 },
    deltaAgg: { type: Number, default: 0 },
  },
  { _id: false }
);

const VJProfile = new Schema(
  {
    POC: { type: Number, default: 0 },
    VAL: { type: Number, default: 0 },
    VAH: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    levelsCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const VJDaySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    instrument: { type: String, required: true, index: true },
    day: { type: String, required: true, index: true }, // YYYY-MM-DD
    tickSize: { type: Number, default: 0.25 },
    source: { type: String, default: "volfix" },

    rows: { type: [VJRow], default: [] },
    profile: { type: VJProfile, default: () => ({}) },
  },
  { timestamps: true }
);

VJDaySchema.index({ userId: 1, instrument: 1, day: 1 }, { unique: true });

const VJDay = mongoose.model("VJDay", VJDaySchema);
export default VJDay;
