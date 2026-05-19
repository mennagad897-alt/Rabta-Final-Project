import mongoose, { Schema, Document } from "mongoose";

// ==========================================
// 🏘️ موديل المجتمعات المتخصصة (Communities)
// ==========================================
// ليه عملنا collection منفصل بدل ما نضيف field في اليوزر؟
// 1. المجتمع ليه بيانات كتير خاصة بيه (اسم، وصف، أعضاء، أدمنز) مينفعش نحشرها في اليوزر
// 2. المجتمع ممكن يكبر ويبقى فيه آلاف الأعضاء، فلازم يكون مستقل عشان الأداء
// 3. كل مجتمع بيكون مرتبط بـ Chat (غرفة محادثة) عشان الأعضاء يتكلموا مع بعض
// 4. بنفصل المسؤوليات: اليوزر مسؤول عن بياناته، والمجتمع مسؤول عن أعضائه

// ==========================================
// [FIX #10] إضافة interface للـ joinRequests
// ==========================================
export interface IJoinRequest {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  requestedAt: Date;
  status: "pending" | "accepted" | "rejected";
}

export interface ICommunity extends Document {
  name: string;
  description: string;
  avatar?: string;
  owner: mongoose.Types.ObjectId;
  admins: mongoose.Types.ObjectId[];
  members: mongoose.Types.ObjectId[];
  invitedUsers?: mongoose.Types.ObjectId[];
  chatId?: mongoose.Types.ObjectId;
  tags?: string[];
  category?: string;
  isPublic: boolean;
  // [FIX #10] مضفناها عشان نقدر نستقبل طلبات الانضمام للـ communities الخاصة
  joinRequests: IJoinRequest[];
  createdAt: Date;
  updatedAt: Date;
}

const CommunitySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Community name is required"],
      trim: true,
      // [FIX #7] شيلنا unique: true من هنا لأنه كان بيمنع أسماء زي "React" و "React js"
      // الـ uniqueness check دلوقتي بيتعمل في الـ pre-save hook بالأسفل بشكل أذكى
    },
    description: {
      type: String,
      required: [true, "Community description is required"],
      trim: true,
    },
    avatar: { type: String, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    invitedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    chatId: { type: Schema.Types.ObjectId, ref: "Chat" },
    tags: [{ type: String, trim: true, lowercase: true }],
    // [FIX #8] category مفيش عليها unique constraint خالص — أكتر من community تقدر تشترك في نفس الـ category
    category: { type: String, trim: true, lowercase: true },
    isPublic: { type: Boolean, default: true },
    // [FIX #10] joinRequests — لطلبات الانضمام للـ communities الخاصة
    joinRequests: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        requestedAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
      },
    ],
  },
  { timestamps: true },
);

// فهرس للبحث السريع بالتاجز
CommunitySchema.index({ tags: 1 });

// ==========================================
// [FIX #7] Pre-save Hook للتحقق من تفرد الاسم بشكل ذكي
// ==========================================
// المنطق:
// - بنعمل trim وnormalize للاسم الجديد (نشيل المسافات الزيادة ونحوله lowercase مؤقتاً للمقارنة بس)
// - بندور في الداتا بيز على أي community اسمها مطابق تماماً بعد الـ normalization
// - "React" و "react" → نفس الشيء (مرفوض)
// - "React" و "React js" → مختلفين (مسموح)
// - "React" و "  React  " → نفس الشيء بعد trim (مرفوض)
CommunitySchema.pre("save", async function () {
  // بنشتغل بس لو الاسم اتغير (سواء عند الإنشاء أو التعديل)
  if (!this.isModified("name")) return;

  const normalizedName = (this.name as string).replace(/\s+/g, " ").trim();
  this.name = normalizedName;
  const normalizedNewName = normalizedName.toLowerCase();

  // بندور على أي community تانية بنفس الاسم بعد الـ normalization (trim + collapse spaces)
  const candidates = await mongoose.model<ICommunity>("Community").find({
    _id: { $ne: this._id as mongoose.Types.ObjectId },
  }).select("name");

  const existingCommunity = candidates.find((c) => {
    const name = String(c.name);
    return name.replace(/\s+/g, " ").trim().toLowerCase() === normalizedNewName;
  });

  if (existingCommunity) {
    const error = new Error(
      `A community with the name "${this.name}" already exists. Please choose a different name.`,
    );
    (error as any).statusCode = 400;
    throw error;
  }
});

export default mongoose.model<ICommunity>("Community", CommunitySchema);
