import * as vectorStoreService from "../../services/Ai/vectorStore.ai.service";
import { catchAsync } from "../../utils/catchAsync";
import { Request, Response } from "express";
import  Chat  from "../../models/chat";
import * as aiAssistantService from "../../services/Ai/aiAssistant.service";
import  Message  from "../../models/Message";

// Endpoint: POST /api/ai/create-vector-store
export const createVectorStore = catchAsync(
  async (req: Request, res: Response) => {
    const { data } = req.body as { data: unknown };

    // نتأكد إن المستخدم باعت الداتا صح كـ Array
    if (!data || !Array.isArray(data)) {
      res.status(400).json({
        status: "error",
        message:
          "Please provide a 'data' array containing objects with a 'text' field.",
      });
      return;
    }

    const result = await vectorStoreService.processAndStoreGlobalData(data);

    res.status(201).json({
      status: "success",
      data: result,
    });
  },
);

// Endpoint: POST /api/v1/ai/ask-global
export const askGlobalAi = catchAsync(async (req: Request, res: Response) => {
  const { question } = req.body;

  if (!question) {
    res.status(400).json({ status: "error", message: "Please provide a question." });
    return;
  }

  const answer = await vectorStoreService.askGlobalKnowledge(question);

  res.status(200).json({
    status: "success",
    data: answer,
  });
});

// Endpoint: POST /api/v1/ai/smart-search
export const smartSearch = catchAsync(async (req: Request, res: Response) => {
  const { query } = req.body;
  const chatId = req.params.chatId;
  const userId = req.user?._id; 

  // خطوة الحماية: لو مفيش query أو مفيش يوزر مسجل دخول ارفض الريكويست فوراً
  if (!query || !userId || !chatId) {
    res.status(400).json({ 
      status: "error", 
      message: "Please provide a search query and ensure you are logged in." 
    });
    return;
  }
  const chat = await Chat.findOne({
    _id: chatId,
    users: userId // ميزة MongoDB إنه بيعرف يدور جوه الـ Array تلقائياً لو مررتيله الـ ID
  });

  // لو الشات مش موجود أو اليوزر مش من ضمن أعضاء الشات
  if (!chat) {
    res.status(403).json({ 
      status: "error", 
      message: "Access denied. You are not a participant in this chat." 
    });
    return;
  }

  // طالما عدى من الـ if اللي فوق، يبقى هو عضو وأمان.. نخليه يبحث بقا
  // التعديل: بنمرر الـ chatId كمان للـ Service عشان يبحث جوه الشات ده بس
  // 1️⃣ لقط اسم اليوزر الحالي ديناميكياً
const currentUserName = (req.user as any).fullName || (req.user as any).name || (req.user as any).firstName || "مستخدم";

// 2️⃣ تمرير الاسم كمتغير رابع للدالة مع تقفيل الـ as any عشان نخلص من خناقات الـ Types
const result = await (vectorStoreService.semanticSearchMessages as any)(
  query, 
  userId.toString(), 
  chatId as string,
  currentUserName
);

  res.status(200).json({
    status: "success",
    data: result,
  });
});




