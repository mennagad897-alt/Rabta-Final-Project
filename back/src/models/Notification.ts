import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  type: 'chatMessages' | 'communityMentions' | 'aiJobMatches' | 'inAppSounds' | 'newApplicant';
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['chatMessages', 'communityMentions', 'aiJobMatches', 'inAppSounds', 'newApplicant'],
    required: true
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<INotification>('Notification', NotificationSchema);
