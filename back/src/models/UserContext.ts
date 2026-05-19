import mongoose, { Schema, Document } from "mongoose";

export interface IUserContext extends Document {
  userId: mongoose.Types.ObjectId;
  interests: string[];
  preferences: Record<string, any>; // عشان نحفظ أي إعدادات تانية مرنة
  createdAt: Date;
  updatedAt: Date;
}

const UserContextSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    interests: [{ type: String }],
    preferences: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.model<IUserContext>("UserContext", UserContextSchema);
