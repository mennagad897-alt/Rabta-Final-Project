import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import Chat from "../../models/chat"; // تأكدي من مسار موديل الشات عندك
import Message from "../../models/Message"; // تأكدي من مسار موديل الرسائل

// استيراد الخدمات (Services)
import * as chatAiService from "../../services/Ai/chat.ai.service"; // الـ RAG القديم
import * as aiAssistantService from "../../services/Ai/aiAssistant.service"; // المساعد الذكي الجديد
// 1. تأكدي إن السطر ده موجود فوق في الكنترولر
import * as vectorStoreService from "../../services/Ai/vectorStore.ai.service";
// ==========================================================
// 1️⃣ الجزء الأول: الـ RAG والبحث العميق (كود يوسف القديم)
// ==========================================================

// دالة تغذية داتا الشات الفردي والملفات المستخرجة منه
export const ingestChat = catchAsync(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const result = await chatAiService.ingestChatData(chatId);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

// دالة سؤال الـ AI في الشات الفردي (البحث الذكي Smart Search)
export const askChat = catchAsync(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const { question } = req.body;

  const userId = req.user?._id?.toString();
  if (!userId) {
    res
      .status(401)
      .json({ status: "error", message: "Unauthorized: No token provided." });
    return;
  }

  const chatDoc = await Chat.findById(chatId);
  if (!chatDoc) {
    res.status(404).json({ status: "error", message: "Chat not found" });
    return;
  }

  const isParticipant = chatDoc.users.some(
    (user: any) => user.toString() === userId,
  );
  if (!isParticipant) {
    res.status(403).json({
      status: "error",
      message:
        "Forbidden: You are not a participant in this chat. Keep out! 🛑",
    });
    return;
  }

  // 1️⃣ جلب اسم اليوزر الحالي ديناميكياً من الـ token
  const currentUserName =
    (req.user as any).fullName ||
    (req.user as any).name ||
    (req.user as any).firstName ||
    "مستخدم";

  const answer = await (vectorStoreService.semanticSearchMessages as any)(
    question,
    userId,
    chatId,
    currentUserName,
  );

  // 3️⃣ الرد بالنتيجة المظبوطة (answer) لليوزر
  res.status(200).json({
    status: "success",
    data: answer,
  });
});

// ==========================================================
// 2️⃣ الجزء الثاني: المساعد الذكي السريع (الـ Endpoints الجديدة)
// ==========================================================

// دالة التلخيص (Summarize) - محمية بـ BOLA ومغلفة بـ catchAsync
export const summarizeChat = catchAsync(async (req: Request, res: Response) => {
  const { chatId, limit = 10 } = req.body;

  // 🛡️ حماية أمنية (BOLA): التأكد إن اليوزر تبع الشات ده
  const userId = req.user?._id?.toString();
  const chatDoc = await Chat.findById(chatId);
  if (
    !chatDoc ||
    !chatDoc.users.some((user: any) => user.toString() === userId)
  ) {
    res
      .status(403)
      .json({ status: "error", message: "Unauthorized access to this chat." });
    return;
  }

  const lastMessages = await Message.find({ chatId })
    .sort({ createdAt: -1 })
    .limit(limit);
  if (lastMessages.length === 0) {
    res
      .status(200)
      .json({ status: "success", data: "لا توجد رسائل كافية لتلخيصها." });
    return;
  }
const compressedMessages: string[] = [];
  let lastSenderId = "";

  // عكس الترتيب لتبدأ من الأقدم إلى الأحدث قبل الضغط
lastMessages.reverse().forEach((msg: any) => {
    if (!msg.content || msg.content.trim() === "") return;

    const currentSenderId = msg.senderId?._id?.toString() || msg.senderId?.toString() || "unknown";
    
    // 💡 التعديل السحري: لو الـ ID بتاع الرسالة هو نفس الـ ID بتاع التوكن، اقلبها لـ "أنت"
    let senderName = "الطرف الآخر"; 
    if (currentSenderId === userId) {
      senderName = "أنت";
    } else {
      senderName = msg.senderName || (msg.senderId as any)?.fullName || "الطرف الآخر";
    }

    if (currentSenderId === lastSenderId && currentSenderId !== "unknown") {
      compressedMessages[compressedMessages.length - 1] += ` . ${msg.content.trim()}`;
    } else {
      compressedMessages.push(`${senderName}: ${msg.content.trim()}`);
      lastSenderId = currentSenderId;
    }
  });
const messagesText = compressedMessages.join("\n");

  // إرسال النص المضغوط للمساعد الذكي
  const summary = await aiAssistantService.summarizeMessages(messagesText);

  res.status(200).json({ status: "success", data: summary });
});
// دالة الإجابة الذكية من السياق الحاد (Answer) - محمية بـ BOLA ومغلفة بـ catchAsync
export const answerQuestion = catchAsync(
  async (req: Request, res: Response) => {
    const { chatId, question } = req.body;

    // 🛡️ حماية أمنية (BOLA)
    const userId = req.user?._id?.toString();
    const chatDoc = await Chat.findById(chatId);
    if (
      !chatDoc ||
      !chatDoc.users.some((user: any) => user.toString() === userId)
    ) {
      res
        .status(403)
        .json({
          status: "error",
          message: "Unauthorized access to this chat.",
        });
      return;
    }

    const answer = await aiAssistantService.answerWithContext(chatId, question);
    res.status(200).json({ status: "success", data: answer });
  },
);

// دالة اقتراح الردود الذكية (Smart Replies) - محمية بـ BOLA ومغلفة بـ catchAsync
export const generateChatReplies = catchAsync(
  async (req: Request, res: Response) => {
    const { chatId } = req.body;

    // 🛡️ حماية أمنية (BOLA)
    const userId = req.user?._id?.toString();
    const chatDoc = await Chat.findById(chatId);
    if (
      !chatDoc ||
      !chatDoc.users.some((user: any) => user.toString() === userId)
    ) {
      res
        .status(403)
        .json({
          status: "error",
          message: "Unauthorized access to this chat.",
        });
      return;
    }

    const lastMessages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .limit(3);
    if (lastMessages.length === 0) {
      res
        .status(200)
        .json({
          status: "success",
          data: ["أهلاً بك!", "كيف يمكنني مساعدتك؟"],
        });
      return;
    }

    const messagesText = lastMessages
      .reverse()
      .map((msg: any) => msg.content)
      .join("\n");
    const result = await aiAssistantService.generateSmartReplies(messagesText);

    let parsedReplies;
    try {
      parsedReplies = JSON.parse(result as string);
    } catch (e) {
      parsedReplies = [result];
    }

    res.status(200).json({ status: "success", data: parsedReplies });
  },
);

// دالة الترجمة الفورية (Translate) - مغلفة بـ catchAsync
export const translateMessage = catchAsync(
  async (req: Request, res: Response) => {
    const { text, targetLang } = req.body;
    const result = await aiAssistantService.translateMessage(text, targetLang);

    res.status(200).json({ status: "success", data: result });
  },
);
