import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  avatar?: string;
  fullName: string;
  email: string;
  password?: string;
  phoneNumber?: string;
  googleId?: string;
  role: 'freelancer' | 'employer' | 'admin';
  profileComplete: boolean;
  isVerified: boolean;
  isBanned?: boolean;
  // Common fields
  jobTitle?: string;
  bioHeadline?: string;
  location?: string;
  about?: string;
  skills?: string[];
  portfolio?: string;
  // Employer specific
  companyName?: string;
  industry?: string;
  website?: string;
  verificationLink?: string;
  savedFreelancers?: mongoose.Types.ObjectId[];
  connections?: mongoose.Types.ObjectId[];
  // Social & Professional
  socialLinks?: {
    github?: string;
    linkedin?: string;
    mostaql?: string;
    khamsat?: string;
  };
  featuredProjects?: Array<{
    title: string;
    description: string;
    link: string;
  }>;
  // Privacy & Notifications Settings
  settings: {
    privacy: {
      showOnline: boolean;
      publicProfile: boolean;
      allowDMs: boolean;
    };
    notifications: {
      chatMessages: boolean;
      communityMentions: boolean;
      aiJobMatches: boolean;
      inAppSounds: boolean;
    };
  };
  savedProjects?: mongoose.Types.ObjectId[];
  status: 'online' | 'offline' | 'busy';
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword: (candidatePassword: string, userPassword: string) => Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [3, 'Full name must be at least 3 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  phoneNumber: {
    type: String,
    required: [
      function (this: any) { return !this.googleId; },
      'Phone number is required'
    ],
    unique: true,
    trim: true
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: [
      function (this: any) { return !this.googleId; },
      'Password is required'
    ],
    select: false,
    minlength: [8, 'Password must be at least 8 characters long']
  },
  role: {
    type: String,
    enum: ['freelancer', 'employer', 'admin'],
    default: 'freelancer',
    required: [true, 'User role is required']
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  profileComplete: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  jobTitle: {
    type: String,
    trim: true
  },
  bioHeadline: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  about: {
    type: String,
    trim: true,
    default: ""
  },
  skills: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  portfolio: {
    type: String,
    trim: true
  },
  companyName: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  verificationLink: {
    type: String,
    trim: true,
    default: ""
  },
  socialLinks: {
    github: { type: String, trim: true, default: "" },
    linkedin: { type: String, trim: true, default: "" },
    mostaql: { type: String, trim: true, default: "" },
    khamsat: { type: String, trim: true, default: "" }
  },
  featuredProjects: [{
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    link: { type: String, trim: true }
  }],
  settings: {
    privacy: {
      showOnline: { type: Boolean, default: true },
      publicProfile: { type: Boolean, default: true },
      allowDMs: { type: Boolean, default: true }
    },
    notifications: {
      chatMessages: { type: Boolean, default: true },
      communityMentions: { type: Boolean, default: true },
      aiJobMatches: { type: Boolean, default: true },
      inAppSounds: { type: Boolean, default: true }
    }
  },
  savedProjects: [{ type: Schema.Types.ObjectId, ref: 'Job' }],
  savedFreelancers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  connections: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: {
    type: String,
    enum: ['online', 'offline', 'busy'],
    default: 'offline'
  },
  avatar: {
    type: String,
    default: ""
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  pendingRequests: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

UserSchema.index({ fullName: 1 });
UserSchema.index({ skills: 1 });
UserSchema.index({ jobTitle: 1 });

UserSchema.pre('save', async function (this: any) {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

UserSchema.methods.comparePassword = async function (candidatePassword: string, userPassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export const User = mongoose.model<IUser>('User', UserSchema);