import { Router } from "express";
import { checkCommunityMembership } from "../middlewares/communityAuth";
import { protect } from "../middlewares/auth.middleware";
import {
  ingestCommunity,
  askCommunityAgent,
} from "../controllers/ai.controller";

const router = Router();

// Endpoint عشان نـ Generate الـ Vectors لجروب معين
router.post("/community/:communityId/ingest", ingestCommunity);

// Endpoint عشان نسيرش جوه الجروب

router.post(
  "/community/:communityId/search",
  protect, // ده الميدلوير الأساسي بتاعكم اللي بيتأكد إن اليوزر عامل لوج إن أصلاً
  checkCommunityMembership, // 👈 ده البواب الجديد بتاعنا
  askCommunityAgent,
);
export default router;
