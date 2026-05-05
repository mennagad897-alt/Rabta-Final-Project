import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import {
  getMessageHistory,
  accessChat,
  getMyChats,
  createGroup,
  addToGroup,
  removeFromGroup,
  leaveGroupChat,
  sendMessage,
  sendAudioMessage,
  sendFileMessage,
  markMessagesAsRead,
  getSharedContent,
  clearChatHistory
} from '../controllers/chat.controller';
import { uploadAudio, uploadMedia, uploadDocument } from '../middlewares/upload.middleware';

const router = Router();

// ==========================================
// 🔒 كل المسارات محمية - لازم اليوزر يكون عامل لوجين
// ==========================================
router.use(protect);

// ==========================================
// 💬 مسارات الشات (Chat Routes)
// ==========================================
// جلب كل محادثات اليوزر
router.get('/', getMyChats);

// إنشاء أو فتح محادثة فردية مع يوزر تاني
router.post('/', accessChat);

// ==========================================
// 👥 مسارات الجروبات (Group Routes) - MUST BE BEFORE Wildcards
// ==========================================
// إنشاء جروب جديد
router.post('/group', createGroup);

// إضافة عضو للجروب (Admin Only)
router.put('/group/add', addToGroup);

// إزالة عضو من الجروب (Admin Only)
router.put('/group/remove', removeFromGroup);

// مغادرة جروب
router.put('/group/:chatId/leave', leaveGroupChat);

// ==========================================
// 📬 مسارات الرسائل (Message Routes)
// ==========================================
// إرسال رسالة نصية لشات معين
router.post('/:id/send', sendMessage);

// إرسال رسالة صوتية لشات معين
router.post('/:id/audio', uploadAudio.single('audio'), sendAudioMessage);

// إرسال رسالة صورة
router.post('/:id/upload/image', uploadMedia.single('file'), sendFileMessage);

// إرسال رسالة مستند
router.post('/:id/upload/document', uploadDocument.single('file'), sendFileMessage);

// تحديد الرسائل كمقروءة
router.put('/:id/read', markMessagesAsRead);

// جلب المحتوى المشارك في شات معين
router.get('/:id/shared', getSharedContent);

// حذف الشات
router.delete('/:id/clear', clearChatHistory);

// ==========================================
// 📜 مسار تاريخ الرسائل (History)
// ==========================================
// جلب رسائل شات معين (مع limit و cursor pagination)
router.get('/:chatId/messages', getMessageHistory);

export default router;
