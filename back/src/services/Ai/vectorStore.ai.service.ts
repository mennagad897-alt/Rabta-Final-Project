import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { StringOutputParser } from "@langchain/core/output_parsers"; // 👈 التعديل الصح هنا
import mongoose from "mongoose";
import { embeddingsModel, llm } from "./core.ai.service"; // 👈 تأكدي من وجود حرف الـ s في اسم الملف
import { globalAiPromptTemplate ,smartSearchPromptTemplate} from "./prompts.ai"; 

// دالة المعالجة والتخزين (التاسك الرابعة)
export const processAndStoreGlobalData = async (sampleData: { text: string; metadata?: any }[]) => {
  const texts = sampleData.map((item) => item.text);
  const metadatas = sampleData.map((item) => item.metadata || {});

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  
  const docs = await splitter.createDocuments(texts, metadatas);

  const client = mongoose.connection.getClient() as any; 
  const collection = client.db("RabtaDB").collection("global_vectors");

  await MongoDBAtlasVectorSearch.fromDocuments(docs, embeddingsModel, {
    collection: collection,
    indexName: "global_vector_index",
    textKey: "text", 
    embeddingKey: "embedding", 
  });

  return {
    message: "Data successfully chunked, embedded, and stored via @langchain/mongodb 🚀",
    chunksProcessed: docs.length,
  };
};

// دالة سؤال قاعدة المعرفة العامة (الـ Endpoint الإضافية)
export const askGlobalKnowledge = async (question: string) => {
  const client = mongoose.connection.getClient() as any;
const collection = client.db("RabtaDB").collection("global_vectors");

  // 1. تعريف الـ Store مع التأكيد على اسم الـ Index
  const vectorStore = new MongoDBAtlasVectorSearch(embeddingsModel, {
    collection: collection,
    indexName: "global_vector_index", // 👈 تأكدي إن الاسم ده مطابق للي في الأطلس بالحرف
    textKey: "text",
    embeddingKey: "embedding",
  });
  const queryEmbedding = await embeddingsModel.embedQuery(question);
console.log("📏 Question Embedding Dimensions:", queryEmbedding.length);
  // 2. البحث الذكي
  const searchResults = await vectorStore.similaritySearch(question, 4);
  
  console.log("🔍 Search Results from Atlas:", searchResults); 

  // لو الأطلس لسه مرجعش حاجة، هنعمل خطوة حماية عشان البوت ميفضلش ساكت
  if (!searchResults || searchResults.length === 0) {
    return "I found the database connection, but the Atlas Vector Index is still syncing the data. Please give it one minute and try again! ⏳";
  }

  const context = searchResults.map((doc) => doc.pageContent).join("\n\n");

  const resolvedModel = await llm; 
  const chain = globalAiPromptTemplate.pipe(resolvedModel).pipe(new StringOutputParser());
  const answer = await chain.invoke({ context, question });

  return answer;
};

// دالة البحث الذكي في الرسائل الشخصية مع حماية البيانات بـ userId
export const semanticSearchMessages = async (query: string, userId: string, chatId: string) => {
  const client = mongoose.connection.getClient() as any;
  // بنبص في الكوليكشن اللي يوسف مخزن فيه رسايل الشات (تأكدي من اسمه، غالباً messages)
  const collection = client.db(process.env.DB_NAME || "RabtaDB").collection("messages");

  const vectorStore = new MongoDBAtlasVectorSearch(embeddingsModel, {
    collection: collection,
    indexName: "messages_vector_index", // اسم الـ index اللي معمول لرسايل الشات
    textKey: "content", // أو الاسم اللي يوسف مخزن بيه نص الرسالة زي message أو content
    embeddingKey: "embedding",
  });

  // الفلترة بالـ userId عشان الخصوصية (Data Isolation)
const filter = {
    senderId: new mongoose.Types.ObjectId(userId),
    chatId: new mongoose.Types.ObjectId(chatId) 
  };

  // البحث عن أعلى 5 قطع/رسايل متشابهة مع الفلتر
  const searchResults = await vectorStore.similaritySearch(query, 5, filter);

  // إدارة حجم السياق (Context Window Management)
  if (!searchResults || searchResults.length === 0) {
    return "No relevant messages found matching your search.";
  }

  const context = searchResults.map((doc) => doc.pageContent).join("\n\n");

  // تشغيل الـ Chain
  const resolvedModel = await llm;
  const chain = smartSearchPromptTemplate.pipe(resolvedModel).pipe(new StringOutputParser());
  const answer = await chain.invoke({ context, question: query });

  return answer;
};