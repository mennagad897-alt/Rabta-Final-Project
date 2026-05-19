import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import * as chatAiService from "../services/Ai/chat.ai.service";
import Chat from "../models/chat";

// 1. دالة تغذية داتا الشات الفردي والملفات المستخرجة منه
export const ingestChat = catchAsync(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const result = await chatAiService.ingestChatData(chatId);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

// 2. دالة سؤال الـ AI في الشات الفردي (مختصرة وبالإنجليزي زي ما طلبتي)
export const askChat = catchAsync(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const { question } = req.body;

  // 1. نتأكد إن اليوزر موجود أصلاً وعامل تسجيل دخول
  const userId = req.user?._id?.toString();
  if (!userId) {
    res
      .status(401)
      .json({ status: "error", message: "Unauthorized: No token provided." });
    return;
  }

  // 2. نجيب الشات من الداتا بيز
  const chatDoc = await Chat.findById(chatId);
  if (!chatDoc) {
    res.status(404).json({ status: "error", message: "Chat not found" });
    return;
  }
const isParticipant = chatDoc.users.some(
      (user: any) => user.toString() === userId
    );

    // 4. لو مش موجود، نطرده بره
    if (!isParticipant) {
      res.status(403).json({ 
        status: "error", 
        message: "Forbidden: You are not a participant in this chat. Keep out! 🛑" 
      });
      return;
    }


  // لو عدى من كل ده، يبقى هو اليوزر الحقيقي
  const aiResponse = await chatAiService.askChatAi(chatId, question);

  res.status(200).json({
    status: "success",
    data: aiResponse,
  });
});
