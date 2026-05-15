import { initChatModel } from "langchain";
import { OpenAIEmbeddings } from "@langchain/openai";
import dotenv from "dotenv";

dotenv.config();

// 1. المحرك الأساسي لتوليد الردود (الـ Agent)
export const llm = initChatModel("gpt-5-mini", {
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. المحرك الأساسي لتحويل النصوص لفيكتورز (الـ RAG)
export const embeddingsModel = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  apiKey: process.env.OPENAI_API_KEY,
});
