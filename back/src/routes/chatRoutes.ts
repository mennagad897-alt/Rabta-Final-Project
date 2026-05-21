import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
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
  markMessagesAsRead,
  respondToChatRequest,
  getSharedContent,
  clearChat,
  clearChatHistory,
  getChatUnreadCount,
  toggleMuteChat,
  sendFileMessage,
} from "../controllers/chat.controller";
import {
  uploadAudio,
  uploadAttachment,
} from "../middlewares/upload.middleware";
import * as chatAiController from "../controllers/AI/chat.ai.controller";


const router = Router();

// ==========================================
// 🔒 كل المسارات محمية - لازم اليوزر يكون عامل لوجين
// ==========================================
router.use(protect);

// ==========================================
// 💬 مسارات الشات (Chat Routes)
// ==========================================
// جلب كل محادثات اليوزر
router.get("/", getMyChats);

// إنشاء أو فتح محادثة فردية مع يوزر تاني
router.post("/", accessChat);

// إرسال رسالة نصية لشات معين
router.post("/:id/send", sendMessage);

// إرسال رسالة صوتية لشات معين
router.post("/:id/audio", uploadAudio.single("audio"), sendAudioMessage);

// رفع المرفقات (ملفات/صور) لشات معين
router.put('/:id/request', respondToChatRequest);
router.post(
  "/:id/upload",
  uploadAttachment.single("document"),
  sendFileMessage,
);

// تحديد الرسائل كمقروءة
router.put("/:id/read", markMessagesAsRead);

// Accept or reject a pending 1-to-1 chat request
router.put("/:id/request", respondToChatRequest);

// جلب المحتوى المشارك في شات معين
router.get("/:id/shared", getSharedContent);

// Soft clear chat history (per-user clearStates)
router.post("/:id/clear", clearChat);

// Hide chat from sidebar list
router.delete("/:id/clear", clearChatHistory);

// كتم الشات
router.put("/:id/mute", toggleMuteChat);

// مثال للمسارات
router.post("/:chatId/ai/ingest", chatAiController.ingestChat);
router.post("/:chatId/ai/ask", chatAiController.askChat);
// ==========================================
// 📜 مسار تاريخ الرسائل (History)
// ==========================================
// Unread count for a chat (respects clearStates)
router.get("/:chatId/unread-count", getChatUnreadCount);

// جلب رسائل شات معين (مع limit و cursor pagination)
// مثال: GET /api/v1/chats/abc123/messages?limit=30&before=xyz789
router.get("/:chatId/messages", getMessageHistory);

// ==========================================
// 👥 مسارات الجروبات (Group Routes)
// ==========================================
// إنشاء جروب جديد
router.post("/group", createGroup);

// إضافة عضو للجروب (Admin Only)
router.put("/group/add", addToGroup);

// إزالة عضو من الجروب (Admin Only)
router.put("/group/remove", removeFromGroup);

// مغادرة جروب
router.put("/group/:chatId/leave", leaveGroupChat);

export default router;
