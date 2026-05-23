import dotenv from "dotenv";
// 👈 استدعاءات متطابقة مع ستايل يوسف في rag.js بالظبط
import { HumanMessage, SystemMessage } from "langchain";
import {
  MemorySaver,
  StateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";

// استدعاء ملف الـ Prompts والمحرك الأساسي
import { AI_ASSISTANT_PROMPTS } from "../Ai/prompts.ai";
import { llm, WHISPER_MODEL, DEEPGRAM_MODEL } from "./core.ai.service";

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
    config,
  );

  return state.messages[state.messages.length - 1].content;
};

export const summarizeMessages = async (messagesText: string) => {
  const systemPrompt = new SystemMessage(AI_ASSISTANT_PROMPTS.SUMMARIZE_SYSTEM);
  const userPrompt = new HumanMessage(
    AI_ASSISTANT_PROMPTS.SUMMARIZE_USER(messagesText),
  );

  const resolvedLlm = await llm;
  const response = await resolvedLlm.invoke([systemPrompt, userPrompt]);
  return response.content;
};

export const generateSmartReplies = async (messagesText: string) => {
  const systemPrompt = new SystemMessage(
    AI_ASSISTANT_PROMPTS.GENERATE_REPLY_SYSTEM,
  );
  const userPrompt = new HumanMessage(`Conversation Context:\n${messagesText}`);

  const resolvedLlm = await llm;
  const response = await resolvedLlm.invoke([systemPrompt, userPrompt]);
  return response.content;
};

export const translateMessage = async (text: string, targetLang: string) => {
  const systemPrompt = new SystemMessage(
    AI_ASSISTANT_PROMPTS.TRANSLATE_SYSTEM(targetLang),
  );
  const userPrompt = new HumanMessage(`Text to translate:\n${text}`);

  const resolvedLlm = await llm;
  const response = await resolvedLlm.invoke([systemPrompt, userPrompt]);
  return response.content;
};

// ==========================================
// 🚀 Speech-to-Text (Whisper AI) - مؤجل لحين حل مشكلة الـ Key
// ==========================================
export const transcribeAudioWhisper = async (
  audioBuffer: Buffer,
  mimetype: string,
  originalName: string,
) => {
  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimetype });

    formData.append("file", blob, originalName || "audio.webm");
    formData.append("model", WHISPER_MODEL);
    formData.append("language", "ar");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ [Whisper API] Transcription failed:", errorData);
      throw new Error("Failed to transcribe audio. Please try again.");
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("❌ [Whisper API] Unexpected error:", error);
    throw new Error("An unexpected error occurred during audio processing.");
  }
};

// ==========================================
// 🚀 Speech-to-Text (Deepgram AI) - المستخدم حالياً للتجربة
// ==========================================
export const transcribeAudioDeepgram = async (
  audioBuffer: Buffer,
  mimetype: string,
) => {
  try {
    const url = `https://api.deepgram.com/v1/listen?model=${DEEPGRAM_MODEL}&language=ar`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": mimetype,
      },
      body: new Uint8Array(audioBuffer),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ [Deepgram API] Transcription failed:", errorData);
      throw new Error("Failed to transcribe audio. Please try again.");
    }

    const data = await response.json();
    const transcript =
      data.results?.channels[0]?.alternatives[0]?.transcript || "";
    return transcript;
  } catch (error) {
    console.error("❌ [Deepgram API] Unexpected error:", error);
    throw new Error("An unexpected error occurred during audio processing.");
  }
};
