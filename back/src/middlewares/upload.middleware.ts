import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils/AppError';

// التأكد من وجود مجلد الرفع بمسار مطلق
const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
console.log('📂 Initializing Upload Directory at:', uploadDir);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. إعداد التخزين المحلي (Disk Storage)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // تسمية الملف: userId + الوقت الحالي + الامتداد الأصلي
    const userId = (req as any).user?._id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// 2. فلتر الأمان
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

// 3. تصدير الميدل وير للصور
export const uploadAvatar = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ==========================================
// 🎙️ إعداد رفع الملفات الصوتية (Audio Upload)
// ==========================================
const audioUploadDir = path.join(process.cwd(), 'uploads', 'audio');
if (!fs.existsSync(audioUploadDir)) {
  fs.mkdirSync(audioUploadDir, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioUploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user?._id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Use .webm as default since browsers record in webm
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `audio-${userId}-${uniqueSuffix}${ext}`);
  }
});

const audioFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('audio') || file.mimetype.includes('webm')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an audio file! Please upload only audio.', 400), false);
  }
};

export const uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit for voice notes
});

// ==========================================
// 📄 إعداد رفع المستندات (Document Upload)
// ==========================================
const documentUploadDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(documentUploadDir)) {
  fs.mkdirSync(documentUploadDir, { recursive: true });
}

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentUploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user?._id || 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${userId}-${uniqueSuffix}${ext}`);
  }
});

const documentFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Not a supported document! Please upload PDF or Word documents.', 400), false);
  }
};

export const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for documents
});