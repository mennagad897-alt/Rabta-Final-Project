import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminLog extends Document {
  adminId: mongoose.Types.ObjectId;
  adminName: string;
  actionType: string;
  targetName: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminLogSchema = new Schema<IAdminLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    actionType: {
      type: String,
      required: true,
    },
    targetName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const AdminLog = mongoose.model<IAdminLog>('AdminLog', adminLogSchema);

export default AdminLog;
