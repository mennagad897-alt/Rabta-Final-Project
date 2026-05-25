import { Router } from "express";
import { checkCommunityMembership } from "../middlewares/communityAuth";
import { protect } from "../middlewares/auth.middleware";
import {
  ingestCommunity,
  askCommunityAgent,
} from "../controllers/AI/community.ai.controller";
import { createVectorStore } from "../controllers/AI/globalAi.controller";
import * as aiController from "../controllers/AI/globalAi.controller";
import multer from "multer";
const uploadMemory = multer({ storage: multer.memoryStorage() });
const router = Router();

// Endpoint عشان نـ Generate الـ Vectors لجروب معين
router.post("/community/:communityId/ingest", ingestCommunity);
import * as chatAiController from "../controllers/AI/chat.ai.controller";

// Endpoint عشان نسيرش جوه الجروب

router.post(
  "/community/:communityId/search",
  protect, // ده الميدلوير الأساسي بتاعكم اللي بيتأكد إن اليوزر عامل لوج إن أصلاً
  checkCommunityMembership, // 👈 ده البواب الجديد بتاعنا
  askCommunityAgent,
);
router.post("/create-vector-store", protect, aiController.createVectorStore);

router.post("/ask-global", protect, aiController.askGlobalAi);

router.post("/chat/ingest/:chatId", protect, chatAiController.ingestChat);
router.post("/chat/ask/:chatId", protect, chatAiController.askChat);

router.post("/smart-search/:chatId", protect, aiController.smartSearch);

router.post("/chat/summarize", protect, chatAiController.summarizeChat);
router.post("/chat/answer", protect, chatAiController.answerQuestion);

router.post("/chat/translate", protect, chatAiController.translateMessage);

router.post(
  "/chat/generate-reply",
  protect,
  chatAiController.generateChatReplies,
);

// Endpoint لتحويل الصوت إلى نص (Whisper STT)
// بنستخدم upload.single('audio') عشان الفرونت إند هيبعت الملف في حقل اسمه 'audio'
router.post(
  "/chat/speech-to-text",
  protect,
  uploadMemory.single("audio"),
  chatAiController.speechToText,
);
export default router;
