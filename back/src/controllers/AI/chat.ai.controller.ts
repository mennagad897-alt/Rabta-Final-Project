import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import Chat from "../../models/chat";
import Message from "../../models/Message";
import { User } from "../../models/user";
import * as chatAiService from "../../services/Ai/chat.ai.service";
import * as aiAssistantService from "../../services/Ai/aiAssistant.service";
import * as vectorStoreService from "../../services/Ai/vectorStore.ai.service";

export const ingestChat = catchAsync(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const result = await chatAiService.ingestChatData(chatId);
  res.status(200).json({ status: "success", data: result });
});

export const askChat = catchAsync(async (req: Request, res: Response) => {
  const chatId = req.params.chatId as string;
  const { question } = req.body;
  const userId = req.user?._id?.toString();

  if (!userId) {
    res.status(401).json({ status: "error", message: "Unauthorized: No token provided." });
    return;
  }

  const chatDoc = await Chat.findById(chatId);
  if (!chatDoc || !chatDoc.users.some((user: any) => user.toString() === userId)) {
    res.status(403).json({ status: "error", message: "Forbidden: Access denied." });
    return;
  }

  const currentUserName = (req.user as any).fullName || (req.user as any).name || "مستخدم";

  const answer = await vectorStoreService.semanticSearchMessages(
    question,
    userId,
    chatId,
    currentUserName
  );

  res.status(200).json({ status: "success", data: answer });
});

export const summarizeChat = catchAsync(async (req: Request, res: Response) => {
  const { chatId, limit = 10 } = req.body;
  const userId = req.user?._id?.toString();

  const chatDoc = await Chat.findById(chatId);
  if (!chatDoc || !chatDoc.users.some((user: any) => user.toString() === userId)) {
    res.status(403).json({ status: "error", message: "Unauthorized access." });
    return;
  }

  // 💡 إضافة populate لـ senderId لجلب الأسماء والوقت بدقة لعملية التلخيص المطور بالأسماء والوقت
  const lastMessages = await Message.find({ chatId })
    .populate("senderId", "fullName")
    .sort({ createdAt: -1 })
    .limit(limit);

  if (lastMessages.length === 0) {
    res.status(200).json({ status: "success", data: "لا توجد رسائل كافية لتلخيصها." });
    return;
  }

  const compressedMessages: string[] = [];
  let lastSenderId = "";

  // الترتيب من الأقدم للأحدث للـ AI
  lastMessages.reverse().forEach((msg: any) => {
    if (!msg.content || msg.content.trim() === "") return;

    const currentSenderId = msg.senderId?._id?.toString() || msg.senderId?.toString() || "unknown";
    const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : "غير محدد";

    let senderName = "الطرف الآخر";
    if (currentSenderId === userId) {
      senderName = "أنت";
    } else {
      senderName = msg.senderName || msg.senderId?.fullName || "الطرف الآخر";
    }

    if (currentSenderId === lastSenderId && currentSenderId !== "unknown") {
      compressedMessages[compressedMessages.length - 1] +=
        ` . ${msg.content.trim()}`;
    } else {
      compressedMessages.push(`[${senderName} في تمام الساعة ${timeStr}]: ${msg.content.trim()}`);
      lastSenderId = currentSenderId;
    }
  });

  const messagesText = compressedMessages.join("\n");
  const summary = await aiAssistantService.summarizeMessages(messagesText);

  res.status(200).json({ status: "success", data: summary });
});

export const answerQuestion = catchAsync(async (req: Request, res: Response) => {
  const { chatId, question } = req.body;
  const answer = await aiAssistantService.answerWithContext(chatId, question);
  res.status(200).json({ status: "success", data: answer });
});

export const generateChatReplies = catchAsync(async (req: Request, res: Response) => {
  const { chatId } = req.body;
  const lastMessages = await Message.find({ chatId }).sort({ createdAt: -1 }).limit(3);

  if (lastMessages.length === 0) {
    res.status(200).json({ status: "success", data: ["مرحباً بك", "كيف يمكنني المساعدة؟"] });
    return;
  }

  const messagesText = lastMessages.reverse().map((msg: any) => msg.content).join("\n");
  const result = await aiAssistantService.generateSmartReplies(messagesText);

  let parsedReplies;
  try { parsedReplies = JSON.parse(result as string); } catch (e) { parsedReplies = [result]; }

  res.status(200).json({ status: "success", data: parsedReplies });
});

export const translateMessage = catchAsync(async (req: Request, res: Response) => {
  const { text, targetLang } = req.body;
  const result = await aiAssistantService.translateMessage(text, targetLang);
  res.status(200).json({ status: "success", data: result });
});

// 🎙️ ميزة زميلك الجديدة (Speech-to-Text Controller) تم دمجها بنجاح
export const speechToText = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    console.warn("⚠️ [SpeechToText] No audio file provided in the request.");
    res.status(400).json({
      status: "error",
      message: "No audio file provided. Please record and try again.",
    });
    return;
  }

  // استخدام Deepgram المفعّل في الـ Service
  const transcribedText = await aiAssistantService.transcribeAudioDeepgram(
    req.file.buffer,
    req.file.mimetype,
  );

  res.status(200).json({
    status: "success",
    data: transcribedText,
  });
});