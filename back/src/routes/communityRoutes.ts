import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { restrictTo } from "../middlewares/authorize.middleware";
import {
  listCommunities,
  createCommunity,
  joinCommunity,
  getCommunityFeed,
  getCommunityChat,
} from "../controllers/community.controller";

const router = Router();

router.use(protect);

router.get("/", listCommunities);
router.post("/", createCommunity);
router.post("/:id/join", joinCommunity);
router.get("/:id/feed", getCommunityFeed);
router.get("/:id/chat", getCommunityChat);

export default router;
