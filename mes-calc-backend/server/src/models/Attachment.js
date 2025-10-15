import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const AttachmentSchema = new Schema(
  {
    userId:    { type: Types.ObjectId, required: true, index: true },
    tradeId:   { type: Types.ObjectId, required: true, index: true },
    kind:      { type: String, enum: ["image", "audio", "file"], required: true, index: true },
    mimeType:  { type: String },
    size:      { type: Number },
    durationMs:{ type: Number },                 // для аудио
    fileId:    { type: Types.ObjectId, required: true, index: true }, // _id файла в GridFS
    name:      { type: String },                 // оригинальное имя
  },
  { timestamps: true }
);

export default mongoose.model("Attachment", AttachmentSchema);
