import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as communityAiService from "../../services/Ai/community.ai.service";
import { getCommunityAgent } from "../../services/Ai/agent.ai.service";
import AiConversation from "../../models/AI/AiConversation";
import AgentLog from "../../models/AI/AgentLog";
import { HumanMessage, AIMessage } from "langchain";

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
    const { message, threadId } = req.body;
    const userId = req.user?._id; // 👈 هياخده من التوكن مباشرة
    
    // لقط اسم المستخدم الحالي عشان الـ Agent يعرف هو بيكلم مين ويذكره باسمه
    const currentUserName = (req.user as any)?.fullName || (req.user as any)?.name || "عضو في المجتمع";

    const rag_agent = await getCommunityAgent(communityId);

    // 1. جلب آخر 5 رسائل فقط من الداتا بيز عشان نوفر توكنز (Windowed Memory)
    const conversation = await AiConversation.findOne({ threadId });
    let lastMessages: any[] = [];

    if (conversation && conversation.messageHistory) {
      const history = conversation.messageHistory.slice(-5);
      
      // 🔥 خوارزمية الضغط الذكي لتوفير التوكنز ومنع التكرار
      const compressedHistory: { role: string; content: string }[] = [];
      
      history.forEach((msg) => {
        if (!msg.content || msg.content.trim() === "") return;
        
        // دمج الرسائل المتتالية لنفس الشخص أو نفس الـ AI في سطر واحد
        if (
          compressedHistory.length > 0 && 
          compressedHistory[compressedHistory.length - 1].role === msg.role
        ) {
          compressedHistory[compressedHistory.length - 1].content += ` . ${msg.content.trim()}`;
        } else {
          compressedHistory.push({ role: msg.role, content: msg.content.trim() });
        }
      });

      // 💡 إصلاح كارثة الأدوار: تفريق رسائل المستخدم عن رسائل الـ AI
      lastMessages = compressedHistory.map((m) => 
        m.role === "assistant" ? new AIMessage(m.content) : new HumanMessage(m.content)
      );
    }

    // 💡 تغذية الـ Agent باسم المستخدم الحالي جوه الرسالة عشان يذكره باسمه في التلخيص
    const Umes = new HumanMessage(`[Sender: ${currentUserName}]: ${message}`);

    // 2. تشغيل الـ Agent
    const response = await rag_agent.invoke(
      { messages: [...lastMessages, Umes] },
      { configurable: { thread_id: threadId || communityId } },
    );

    // 👈 ضفنا as string في آخر السطر زي ما يوسف عامل
    const aiResponse = response.messages[response.messages.length - 1].content as string;

    // 3. تحديث تاريخ المحادثة في الداتا بيز (حفظ الرسالة الأصلية بدون إضافات برمجية للفرونت إند)
    await AiConversation.findOneAndUpdate(
      { threadId },
      {
        userId,
        $push: {
          messageHistory: [
            { role: "user", content: message }, // بنحفظ message الصافية هنا عشان شكل الـ UI
            { role: "assistant", content: aiResponse },
          ],
        },
      },
      { upsert: true },
    );

    // 4. تسجيل العملية في الـ Logs للأدمن (شغل يوسف زي ما هو)
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
