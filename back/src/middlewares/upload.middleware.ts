import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { AppError } from '../utils/AppError';

// ==========================================
// ☁️ إعداد الاتصال بـ Cloudinary
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// 🖼️ إعداد رفع الصور (Avatars)
// ==========================================
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'rabta_avatars', // اسم الفولدر اللي هيتكريت على كلاوديناري
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    resource_type: 'image',
  } as any,
});

const imageFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ==========================================
// 🎙️ إعداد رفع الملفات الصوتية (Audio)
// ==========================================
const audioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'rabta_audio',
    resource_type: 'video', // ملاحظة: Cloudinary بيعامل الملفات الصوتية على إنها Video
  } as any,
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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// ==========================================
// 📄 إعداد رفع المستندات (Documents)
// ==========================================
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'rabta_documents',
    resource_type: 'raw', // ملفات الـ PDF والـ Word بتترفع كـ Raw data
  } as any,
});

const documentFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ==========================================
// 📎 إعداد رفع المرفقات العامة (General Attachments)
// ==========================================
// ==========================================
// 📎 إعداد رفع المرفقات العامة (General Attachments)
// ==========================================
const attachmentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isDocument = file.mimetype === 'application/pdf' || file.mimetype.includes('document') || file.mimetype.includes('text');
    
    // هبنعمل اسم فريد للملَف وبنحافظ على الامتداد الأصلي (.pdf) في الآخر
    const uniqueFileName = `${Date.now()}-${file.originalname}`;

    return {
      folder: 'rabta_attachments',
      resource_type: isDocument ? 'raw' : 'auto', 
      public_id: uniqueFileName, // 👈 السطر ده هيجبر كلاوديناري يحفظ الملف بامتداده الأصلي
    };
  },
});

const attachmentFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Unsupported file type for attachment.', 400), false);
  }
};

export const uploadAttachment = multer({
  storage: multer.memoryStorage(),
  fileFilter: attachmentFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});