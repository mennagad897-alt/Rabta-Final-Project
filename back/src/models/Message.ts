import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  content?: string;
  embedding: {
    type: [Number];
    default: []; // عشان لو رسالة مفيهاش نص ميعملش مشكلة
    select: false; // (اختياري) عشان الأرقام دي مترجعش للفرونت إند وتقلل سرعة الشات، إحنا محتاجينها في الباك إند بس للبحث
  };
  audioUrl?: string;
  postId?: mongoose.Types.ObjectId;
  mediaUrl?: string;
  likesCount?: number;
  commentsCount?: number;
  likesData?: { _id: mongoose.Types.ObjectId; fullName: string }[];
  messageType:
    | "text"
    | "code_snippet"
    | "image"
    | "file"
    | "audio"
    | "call_summary"
    | "post";
  attachments?: {
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }[];
  readBy?: mongoose.Types.ObjectId[];
  status: "sending" | "sent" | "delivered" | "read";
  isEdited: boolean;
  isDeletedForEveryone: boolean;
  hiddenFor: mongoose.Types.ObjectId[];
  duration?: number;
  isPinned: boolean;
  isForwarded: boolean;
  replyTo?: mongoose.Types.ObjectId;
  reactions: {
    userId: mongoose.Types.ObjectId;
    emoji: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String },
    embedding: {
      type: [Number],
      default: [],
    },
    audioUrl: { type: String },
    messageType: {
      type: String,
      enum: [
        "text",
        "code_snippet",
        "image",
        "file",
        "audio",
        "call_summary",
        "post",
      ],
      default: "text",
    },
    postId: { type: Schema.Types.ObjectId, ref: "Post" }, // 💡 ربطنا الرسالة بالبوست
    mediaUrl: { type: String },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    likesData: [
      {
        _id: { type: Schema.Types.ObjectId, ref: "User" },
        fullName: String,
      },
    ],
    attachments: [
      {
        fileUrl: String,
        fileType: String,
        fileSize: Number,
      },
    ],
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["sending", "sent", "delivered", "read"],
      default: "sent",
    },
    isEdited: { type: Boolean, default: false },
    isDeletedForEveryone: { type: Boolean, default: false },
    hiddenFor: [{ type: Schema.Types.ObjectId, ref: "User" }],
    duration: { type: Number },
    isPinned: { type: Boolean, default: false },
    isForwarded: { type: Boolean, default: false },
    replyTo: { type: Schema.Types.ObjectId, ref: "Message" },
    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        emoji: String,
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model<IMessage>("Message", MessageSchema);
