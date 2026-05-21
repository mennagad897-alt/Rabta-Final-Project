import mongoose, { Schema, Document } from "mongoose";

export interface CommunityChunk extends Document {
  communityId: mongoose.Types.ObjectId; // ربط بالمجتمع الأساسي
  content: string; // النص (الـ Chunk) سواء كان رسالة أو بوست أو وصف
  embedding: number[]; // الفيكتور (1536 رقم)
  metadata: {
    authorId?: mongoose.Types.ObjectId; // الاسم الموحد لصاحب الداتا (senderId أو authorId)
    sourceId: mongoose.Types.ObjectId; // ID الرسالة أو البوست أو المجتمع الأصلي
    sourceType: "community_info" | "chat" | "post" | "file"; // نوع المصدر
    timestamp: Date; // وقت إنشاء الداتا الأصلي
  };
}

const CommunityChunkSchema: Schema = new Schema(
  {
    communityId: {
      type: Schema.Types.ObjectId,
      ref: "Community",
      required: false,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: false,
    },
    content: { type: String, required: true },
    embedding: { type: [Number], required: true },
    metadata: {
      authorId: { type: Schema.Types.ObjectId, ref: "User" },
      sourceId: { type: Schema.Types.ObjectId, required: true },
      sourceType: {
        type: String,
        enum: ["community_info", "chat", "post", "file"],
        required: true,
      },
      timestamp: { type: Date, default: Date.now },
    },
  },
  { timestamps: true },
);

// فهرس للبحث السريع بالكوميونتي والنوع
CommunityChunkSchema.index({ communityId: 1, "metadata.sourceType": 1 });

export default mongoose.model<CommunityChunk>(
  "CommunityChunk",
  CommunityChunkSchema,
);
