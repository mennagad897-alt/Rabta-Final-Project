import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { restrictTo } from "../middlewares/authorize.middleware";
import {
  listCommunities,
  searchCommunities,
  createCommunity,
  joinCommunity,
  manageJoinRequest,
  leaveCommunity,
  getCommunityFeed,
  getCommunityChat,
} from "../controllers/community.controller";

const router = Router();

router.use(protect);

router.get("/", listCommunities);
router.get("/search", searchCommunities);
router.post("/", createCommunity);
router.post("/:id/join", joinCommunity);
router.post("/:id/leave", leaveCommunity);
router.put("/:id/requests/:userId", manageJoinRequest);
router.get("/:id/feed", getCommunityFeed);
router.get("/:id/chat", getCommunityChat);

export default router;
