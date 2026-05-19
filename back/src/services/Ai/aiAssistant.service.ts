import { MemorySaver, StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { AI_ASSISTANT_PROMPTS } from "../Ai/prompts.ai"; 

// 👈 هنا بنعمل Import للمحرك الجاهز من الفايل بتاعكم (عدلي المسار حسب مكان الفايل)
import { llm } from "../Ai/core.ai.service"; 

// تهيئة الذاكرة للـ LangGraph
const memory = new MemorySaver();

// بناء مسار المحادثة (الـ Graph) باستخدام الـ llm المركزي الجاهز

export const getAssistantGraph = async () => {
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      // 👈 بنستنى الموديل يجهز الأول
      const resolvedLlm = await llm; 
      // 👈 وبعدين نستخدمه
      const response = await resolvedLlm.invoke(state.messages); 
      return { messages: [response] };
    })
    .addEdge("__start__", "agent");

  return workflow.compile({ checkpointer: memory });
};

// ==========================================
// 🚀 الدوال الأساسية (Endpoints Logic)
// ==========================================

// 1. دالة الإجابة على الأسئلة مع حفظ السياق (Q&A)
export const answerWithContext = async (threadId: string, question: string) => {
  const graph = await getAssistantGraph();
  const config = { configurable: { thread_id: threadId } };
  
  const state = await graph.invoke(
    { messages: [new HumanMessage(question)] },
    config
  );
  
  return state.messages[state.messages.length - 1].content;
};

// 2. دالة التلخيص (Summarize)
export const summarizeMessages = async (messagesText: string) => {
  const systemPrompt = new SystemMessage(AI_ASSISTANT_PROMPTS.SUMMARIZE_SYSTEM);
  const userPrompt = new HumanMessage(AI_ASSISTANT_PROMPTS.SUMMARIZE_USER(messagesText));
  
  // 👈 بنستنى الموديل يجهز الأول
  const resolvedLlm = await llm; 
  // 👈 وبعدين نبعتله الرسايل
  const response = await resolvedLlm.invoke([systemPrompt, userPrompt]); 
  return response.content;
};