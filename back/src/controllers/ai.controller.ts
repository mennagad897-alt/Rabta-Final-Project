import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import * as communityAiService from "../services/Ai/community.ai.service";
import { HumanMessage } from "langchain";
import { getCommunityAgent } from "../services/Ai/agent.ai.service";
import AiConversation from "../models/AiConversation";
import AgentLog from "../models/AgentLog";

// 1. دالة تغذية البيانات (زي ما هي)
export const ingestCommunity = catchAsync(
  async (req: Request, res: Response) => {
    const communityId = req.params.communityId as string;
    const result =
      await communityAiService.processCommunityKnowledge(communityId);
    res.status(200).json({ status: "success", data: result });
  },
);

// 2. دالة الـ Agent الذكي (تعديل دالة البحث القديمة)
export const askCommunityAgent = catchAsync(
  async (req: Request, res: Response) => {
    const communityId = req.params.communityId as string;
    const { message, threadId, userId } = req.body; // userId مهم عشان الموديلز الجديدة

    const rag_agent = await getCommunityAgent(communityId);

    // 1. جلب آخر 5 رسائل فقط من الداتا بيز عشان نوفر توكنز (Windowed Memory)
    const conversation = await AiConversation.findOne({ threadId });
    const lastMessages = conversation
      ? conversation.messageHistory
          .slice(-5)
          .map((m) => new HumanMessage(m.content))
      : [];

    const Umes = new HumanMessage(message);

    // 2. تشغيل الـ Agent
    const response = await rag_agent.invoke(
      { messages: [...lastMessages, Umes] },
      { configurable: { thread_id: threadId || communityId } },
    );

    // 👈 ضفنا as string في آخر السطر
    const aiResponse = response.messages[response.messages.length - 1]
      .content as string;
    // 3. تحديث تاريخ المحادثة في الداتا بيز (حفظ الكل للفرونت إند)
    await AiConversation.findOneAndUpdate(
      { threadId },
      {
        userId,
        $push: {
          messageHistory: [
            { role: "user", content: message },
            { role: "assistant", content: aiResponse },
          ],
        },
      },
      { upsert: true },
    );

    // 4. تسجيل العملية في الـ Logs للأدمن
    await AgentLog.create({
      userId,
      agentType: "CommunityAgent",
      query: message,
      response: aiResponse,
    });

    res.status(200).json({
      status: "success",
      data: aiResponse,
    });
  },
);
