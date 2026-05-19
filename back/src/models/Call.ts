import mongoose, { Schema, Document } from 'mongoose';

export interface ICall extends Document {
  caller: mongoose.Types.ObjectId;   // الطالب أو الشركة (البادئ)
  receiver?: mongoose.Types.ObjectId; // الطرف المستلم (اختياري لو مكالمة جروب)
  communityId?: mongoose.Types.ObjectId; // الجروب (لو مكالمة جروب)
  chatId?: mongoose.Types.ObjectId; // معرف الشات المرتبط بالمكالمة
  type: 'voice' | 'video' | 'group'; // نوع المكالمة
  status: 'missed' | 'rejected' | 'accepted' | 'ended';
  duration: number;
  startedAt: Date;
}

const callSchema = new Schema<ICall>({
  caller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: Schema.Types.ObjectId, ref: 'User' },
  communityId: { type: Schema.Types.ObjectId, ref: 'Community' },
  chatId: { type: Schema.Types.ObjectId, ref: 'Chat' },
  type: { type: String, enum: ['voice', 'video', 'group'], default: 'video' },
  status: { type: String, enum: ['missed', 'rejected', 'accepted', 'ended'], default: 'missed' },
  duration: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<ICall>('Call', callSchema);
