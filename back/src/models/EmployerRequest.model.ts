import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployerRequest extends Document {
  companyName: string;
  companyEmail: string;
  linkedinUrl?: string;
  contactPersonName: string;
  industry: string;
  companySize: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  website?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  invitationToken?: string;
  invitationSentAt?: Date;
  createdAt: Date;
}

const EmployerRequestSchema: Schema = new Schema({
  companyName: { type: String, required: true },
  companyEmail: { type: String, required: true, unique: true },
  linkedinUrl: { type: String },
  contactPersonName: { type: String, required: true },
  industry: { type: String, required: true },
  companySize: { 
    type: String, 
    enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
    required: true 
  },
  website: { type: String },
  message: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  invitationToken: { type: String },
  invitationSentAt: { type: Date }
}, { timestamps: true });

export default mongoose.model<IEmployerRequest>('EmployerRequest', EmployerRequestSchema);
