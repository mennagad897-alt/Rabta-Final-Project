import { Request, Response, NextFunction } from "express";
import Community from "../models/Community"; // اتأكدي من مسار واسم موديل الجروب عندكم

export const checkCommunityMembership = async (req: Request | any, res: Response, next: NextFunction) => {
  try {
    const communityId = req.params.communityId;
    // بنفترض إن ميدلوير الـ Auth الأساسي بتاعكم بيحط بيانات اليوزر في req.user
    const userId = req.user?._id; 

    if (!userId) {
      return res.status(401).json({ status: "fail", message: "You must be logged in" });
    }

    // بندور على الجروب في الداتابيز
    const community = await Community.findById(communityId);

    if (!community) {
      return res.status(404).json({ status: "fail", message: "Community not found" });
    }

    // بنسأل: هل الـ userId بتاع الشخص ده موجود جوه لستة أعضاء الجروب؟
    // (لو اسم الـ array عندكم مختلف عن members، غيريها هنا)
    const isMember = community.members.includes(userId);

    if (!isMember) {
      return res.status(403).json({ 
        status: "fail", 
        message: "Forbidden: You are not a member of this community" 
      });
    }

    // لو هو عضو فعلاً، البواب هيفتحله الباب ويدخله للـ AI
    next(); 
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server Error" });
  }
};