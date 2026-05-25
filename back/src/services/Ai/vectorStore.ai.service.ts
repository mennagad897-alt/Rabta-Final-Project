import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { StringOutputParser } from "@langchain/core/output_parsers";
import mongoose from "mongoose";
import { embeddingsModel, llm } from "./core.ai.service";
import { smartSearchPromptTemplate, globalAiPromptTemplate } from "./prompts.ai";
import { User } from "../../models/user";

export const processAndStoreGlobalData = async (sampleData: { text: string; metadata?: any }[]) => {
  const texts = sampleData.map((item) => item.text);
  const metadatas = sampleData.map((item) => item.metadata || {});
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
  const docs = await splitter.createDocuments(texts, metadatas);

  const client = mongoose.connection.getClient() as any;
  const collection = client.db("RabtaDB").collection("global_vectors");

  await MongoDBAtlasVectorSearch.fromDocuments(docs, embeddingsModel, {
    collection: collection,
    indexName: "global_vector_index",
    textKey: "text",
    embeddingKey: "embedding",
  });

  return { message: "Data successfully stored 🚀", chunksProcessed: docs.length };
};

export const askGlobalKnowledge = async (question: string) => {
  const client = mongoose.connection.getClient() as any;
  const collection = client.db(process.env.DB_NAME || "RabtaDB").collection("global_vectors");

  const vectorStore = new MongoDBAtlasVectorSearch(embeddingsModel, {
    collection: collection,
    indexName: "global_vector_index",
    textKey: "text",
    embeddingKey: "embedding",
  });

  const searchResults = await vectorStore.similaritySearch(question, 5);

  let context = "No document context available.";
  if (searchResults && searchResults.length > 0) {
    context = searchResults.map(doc => doc.pageContent).join("\n");
  }

  const resolvedModel = await llm;
  const chain = globalAiPromptTemplate.pipe(resolvedModel).pipe(new StringOutputParser());

  const answer = await chain.invoke({
    context,
    question,
  } as any);

  return answer;
};

export const semanticSearchMessages = async (query: string, userId: string, chatId: string, currentUserName: string) => {
  const client = mongoose.connection.getClient() as any;
  const collection = client.db(process.env.DB_NAME || "RabtaDB").collection("communitychunks");

  const vectorStore = new MongoDBAtlasVectorSearch(embeddingsModel, {
    collection: collection,
    indexName: "vector_index",
    textKey: "content",
    embeddingKey: "embedding",
  });

  const filter = {
    chatId: new mongoose.Types.ObjectId(chatId),
    "metadata.sourceType": { $in: ["chat", "file", "pdf"] }
  };

  const searchResults = await vectorStore.similaritySearch(query, 10, filter);

  if (!searchResults || searchResults.length === 0) {
    return "لم يتم العثور على رسائل أو ملفات مطابقة لبحثك في هذا الشات.";
  }

  const contextPromises = searchResults.map(async (doc) => {
    const sourceType = doc.metadata?.sourceType || "chat";
    const isFile = sourceType === "file" || sourceType === "pdf" || doc.pageContent.includes("Attached PDF Content");

    let sender = doc.metadata?.senderName;

    if (!sender || sender === "مستخدم في الشات") {
      if (doc.metadata?.senderId) {
        const userDoc = await User.findById(doc.metadata.senderId);
        if (userDoc) {
          sender = (userDoc as any).fullName || (userDoc as any).name;
        }
      }
    }

    if (!sender) {
      sender = isFile ? "ملف مرفوع" : "عضو في الشات";
    }

    if (sender === currentUserName || sender === "أنت (You)") {
      sender = "أنت";
    }

    // تنسيق الوقت بالكامل ليفهمه الـ AI بوضوح للإجابة على سؤال (أمتى)
    // 🔥 حماية قراءة الوقت: لو مبعوت بأي صيغة، حوله لنص مقروء فوراً
    let time = "غير محدد";
    if (doc.metadata?.timestamp) {
      try {
        time = new Date(doc.metadata.timestamp).toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        console.error("❌ خطأ في تحويل الوقت:", e);
      }
    }

    const cleanContent = doc.pageContent.replace(/\s+/g, ' ').trim();
    const sourceTag = isFile ? `File content uploaded by ${sender}` : `Message from ${sender}`;

    return `[Source: ${sourceTag} | Time: ${time}] -> ${cleanContent}`;
  });

  const contextArray = await Promise.all(contextPromises);
  const context = contextArray.join("\n");

  console.log("📊 Smart Context dynamically built:\n", context);

  const resolvedModel = await llm;
  const chain = smartSearchPromptTemplate.pipe(resolvedModel).pipe(new StringOutputParser());

  const answer = await chain.invoke({
    context,
    question: query,
    currentUserName: currentUserName
  } as any);

  return answer;
};