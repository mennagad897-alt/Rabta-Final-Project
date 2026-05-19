// ==========================================
// 1. User & Auth Interfaces
// ==========================================

export type UserRole = "student" | "freelancer" | "employer";
export type UserStatus = "Online" | "Offline";

export interface User {
  _id: string; // تم التعديل لتطابق الـ ObjectId في MongoDB
  full_name: string; // بناءً على Schema الباك-إند
  email: string;
  role: UserRole;
  track_name?: string;
  skills?: string[];
  portfolio_links?: string[];
  company_name?: string; // خاص بصاحب العمل
  status?: UserStatus;
  bio?: string;
  avatar?: string; // خليناها اختياري لو الباك إند ضافها بعدين
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ==========================================
// 2. Chat & Group Interfaces
// ==========================================

export interface Chat {
  _id: string;
  is_group: boolean;
  users: string[]; // مصفوفة بـ IDs الأعضاء
  group_name?: string;
  group_avatar?: string;
  admins?: string[];
  latest_message?: string; // ID آخر رسالة
}

export interface Attachment {
  file_url: string;
  file_type: string;
}

export interface Message {
  _id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: "text" | "code_snippet" | "image" | "file";
  attachments?: Attachment[];
  read_by?: string[]; // IDs المستخدمين اللي قرأوا الرسالة
  created_at: string; // يفضل استقبالها كـ string من الـ API
}

// ==========================================
// 3. Post Interfaces
// ==========================================

export interface Comment {
  user_id: string;
  content: string;
  created_at: string;
}

export interface Post {
  _id: string;
  author_id: string;
  content: string;
  media?: string[]; // روابط الصور والفيديوهات
  likes?: string[]; // مصفوفة بـ IDs اللي عملوا لايك
  comments?: Comment[];
}

// ==========================================
// 4. Job Interfaces
// ==========================================

export type JobType = "freelance" | "full_time" | "part_time";
export type JobStatus = "Open" | "Closed";

export interface Applicant {
  user_id: string;
  proposal: string;
  status: string;
}

export interface Job {
  _id: string;
  publisher_id: string; // بناءً على الـ Schema
  title: string;
  job_type: JobType;
  description: string;
  budget?: string;
  applicants?: Applicant[];
  status: JobStatus;
}
