import mongoose, { Schema, Document } from 'mongoose';


export interface IChat extends Document {
  isGroup: boolean;
  users: mongoose.Types.ObjectId[];
  groupName?: string;
  groupAvatar?: string;
  admins?: mongoose.Types.ObjectId[];
  isPrivate: boolean;
  status?: 'pending' | 'accepted';
  initiatedBy?: mongoose.Types.ObjectId;
  mutedBy?: mongoose.Types.ObjectId[];
  /** Per-user soft clear: messages at/before this time are hidden for that user only */
  clearStates?: { user: mongoose.Types.ObjectId; clearedAt: Date }[];
  /** Users who have hidden this chat from their list */
  hiddenBy?: mongoose.Types.ObjectId[];
  latestMessage?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}


const ChatSchema: Schema = new Schema({
  isGroup: { type: Boolean, default: false },
  users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  groupName: { type: String },
  groupAvatar: { type: String },
  admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  isPrivate: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'accepted',
  },
  initiatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  mutedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  clearStates: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clearedAt: { type: Date, required: true }
  }],
  hiddenBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  latestMessage: { type: Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });


export default mongoose.model<IChat>('Chat', ChatSchema);