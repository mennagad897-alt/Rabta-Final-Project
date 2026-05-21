import dotenv from 'dotenv';
// 👈 استدعاءات متطابقة مع ستايل يوسف في rag.js بالظبط
import { HumanMessage, SystemMessage } from 'langchain';
import { MemorySaver, StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// استدعاء ملف الـ Prompts والمحرك الأساسي
import { AI_ASSISTANT_PROMPTS } from "../Ai/prompts.ai"; 
import { llm } from "./core.ai.service"; 

dotenv.config(); // زي ما يوسف عامل بالظبط

// 1. تهيئة الذاكرة 
const memory = new MemorySaver();

// 2. بناء مسار المحادثة (الـ Graph) 
export const getAssistantGraph = async () => {
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const resolvedLlm = await llm; 
      const response = await resolvedLlm.invoke(state.messages); 
      return { messages: [response] };
    })
    .addEdge("__start__", "agent");

  return workflow.compile({ checkpointer: memory });
};

// ==========================================
// 🚀 الدوال الأساسية (Endpoints Logic)
// ==========================================

export const answerWithContext = async (threadId: string, question: string) => {
  const graph = await getAssistantGraph();
  const config = { configurable: { thread_id: threadId } };
  
  const state = await graph.invoke(
    { messages: [new HumanMessage(question)] },
    config
  );
  
  return state.messages[state.messages.length - 1].content;
};

export const summarizeMessages = async (messagesText: string) => {
  const systemPrompt = new SystemMessage(AI_ASSISTANT_PROMPTS.SUMMARIZE_SYSTEM);
  const userPrompt = new HumanMessage(AI_ASSISTANT_PROMPTS.SUMMARIZE_USER(messagesText));
  
  const resolvedLlm = await llm; 
  const response = await resolvedLlm.invoke([systemPrompt, userPrompt]); 
  return response.content;
};

export const generateSmartReplies = async (messagesText: string) => {
  const systemPrompt = new SystemMessage(AI_ASSISTANT_PROMPTS.GENERATE_REPLY_SYSTEM);
  const userPrompt = new HumanMessage(`Conversation Context:\n${messagesText}`);
  
  const resolvedLlm = await llm; 
  const response = await resolvedLlm.invoke([systemPrompt, userPrompt]); 
  return response.content; 
};

export const translateMessage = async (text: string, targetLang: string) => {
  const systemPrompt = new SystemMessage(AI_ASSISTANT_PROMPTS.TRANSLATE_SYSTEM(targetLang));
  const userPrompt = new HumanMessage(`Text to translate:\n${text}`);
  
  const resolvedLlm = await llm; 
  const response = await resolvedLlm.invoke([systemPrompt, userPrompt]); 
  return response.content;
};