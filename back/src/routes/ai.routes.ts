import { Router } from "express";
import {
  ingestCommunity,
  askCommunityAgent,
} from "../controllers/ai.controller";
// import { protect } from '../middlewares/auth.middleware'; // لو محتاج تخليها Protected

const router = Router();

// Endpoint عشان نـ Generate الـ Vectors لجروب معين
router.post("/community/:communityId/ingest", ingestCommunity);

// Endpoint عشان نسيرش جوه الجروب
router.post("/community/:communityId/search", askCommunityAgent);

export default router;
