import mongoose, { Schema, Document } from 'mongoose';


export interface IJob extends Document {
  publisherId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  jobType: 'freelance' | 'full_time' | 'part_time';
  requiredSkills?: string[];
  budgetOrSalary?: string;
  status: 'open' | 'closed';
  applicants?: {
    userId: mongoose.Types.ObjectId;
    proposal: string;
    status: 'pending' | 'accepted' | 'rejected';
    appliedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}


const JobSchema: Schema = new Schema({
  publisherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  jobType: { 
    type: String, 
    enum: ['freelance', 'full_time', 'part_time'], 
    required: true 
  },
  requiredSkills: [{ type: String }],
  budgetOrSalary: { type: String },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  applicants: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    proposal: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    appliedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model<IJob>('Job', JobSchema);