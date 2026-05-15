import mongoose, { Schema, Document } from "mongoose";

export interface IAiConversation extends Document {
  userId: mongoose.Types.ObjectId;
  threadId: string;
  messageHistory: {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const AiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    threadId: { type: String, required: true, unique: true },
    messageHistory: [
      {
        role: {
          type: String,
          enum: ["user", "assistant", "system"],
          required: true,
        },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.model<IAiConversation>(
  "AiConversation",
  AiConversationSchema,
);
