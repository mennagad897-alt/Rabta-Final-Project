import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { StringOutputParser } from "@langchain/core/output_parsers"; // 👈 التعديل الصح هنا
import mongoose from "mongoose";
import { embeddingsModel, llm } from "./core.ai.service"; // 👈 تأكدي من وجود حرف الـ s في اسم الملف
import { globalAiPromptTemplate ,smartSearchPromptTemplate} from "./prompts.ai"; 
import{User}  from "../../models/user";
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
    indexName: "vector_index", // 👈 تأكدي إن الاسم ده مطابق للي في الأطلس بالحرف
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
    return "عذراً، لا أمتلك معلومات كافية للإجابة على هذا السؤال في الوقت الحالي. ربما يتم تحديث بيانات النظام، يرجى المحاولة مرة أخرى بعد قليل، أو التواصل مع الدعم الفني.";
  }

  const context = searchResults.map((doc) => doc.pageContent).join("\n\n");

  const resolvedModel = await llm; 
  const chain = globalAiPromptTemplate.pipe(resolvedModel).pipe(new StringOutputParser());
  const answer = await chain.invoke({ context, question });

  return answer;
};

// 1. أضفنا currentUserName كـ Parameter رابع عشان يستقبل اسم اليوزر الحالي ديناميكياً
export const semanticSearchMessages = async (query: string, userId: string, chatId: string, currentUserName: string) => {
  const client = mongoose.connection.getClient() as any;
  const collection = client.db(process.env.DB_NAME || "RabtaDB").collection("communitychunks");

  const vectorStore = new MongoDBAtlasVectorSearch(embeddingsModel, {
    collection: collection,
    indexName: "vector_index", 
    textKey: "content", 
    embeddingKey: "embedding",
  });

  // 💡 التعديل السحري للـ Filter: السماح بالبحث في رسائل الشات والملفات المرفوعة معاً داخل هذا الشات
  const filter = {
    chatId: new mongoose.Types.ObjectId(chatId),
    "metadata.sourceType": { $in: ["chat", "file", "pdf"] } // 👈 صلحنا الثغرة عشان يقرأ الـ PDFs والملفات
  };

  const searchResults = await vectorStore.similaritySearch(query, 5, filter);

  if (!searchResults || searchResults.length === 0) {
    return "No relevant messages or files found matching your search.";
  }

  // 4️⃣ بناء السياق ديناميكياً مع تصليح هوية المتحدث ومنع "مستخدم في الشات"
  const contextPromises = searchResults.map(async (doc) => {
    const sourceType = doc.metadata?.sourceType || "chat";
    const isFile = sourceType === "file" || sourceType === "pdf" || doc.pageContent.includes("Attached PDF Content");
    
    let sender = doc.metadata?.senderName;

    // لو مفيش اسم مرسل (زي حالة الملفات المرفوعة) أو الاسم الافتراضي القديم موجود
    if (!sender || sender === "مستخدم في الشات") {
      if (doc.metadata?.senderId) {
        const userDoc = await User.findById(doc.metadata.senderId);
        if (userDoc) {
          sender = (userDoc as any).fullName || (userDoc as any).name;
        }
      }
    }

    // حماية إضافية للأسماء في حالة الملفات
    if (!sender) {
      sender = isFile ? "ملف مرفوع" : "عضو في الشات";
    }

    // المقارنة العبقرية: لو هو نفسه اسم اليوزر الحالي، اقلبها لـ "أنت"
    if (sender === currentUserName || sender === "أنت (You)") {
      sender = "أنت";
    }

    const time = doc.metadata?.timestamp ? new Date(doc.metadata.timestamp).toLocaleTimeString() : "غير محدد";
    
    // 🔥 تنظيف النص المسترجع من أي مسافات زائدة ومزعجة للـ AI بالـ Regex
    const cleanContent = doc.pageContent.replace(/\s+/g, ' ').trim();

    // تشكيل ديباجة المصدر بوضوح عشان الـ Prompt الجديد يفصل بينهم
    const sourceTag = isFile ? `File: ${sender}` : `Chat Sender: ${sender}`;

    return `[Source: ${sourceTag} | Time: ${time}] -> ${cleanContent}`;
  });

  const contextArray = await Promise.all(contextPromises);
  const context = contextArray.join("\n"); // فصل بسطر ليفهم الـ AI الفروقات
    
  console.log("📊 Smart Context dynamically built:\n", context);

  // تشغيل الـ Chain
  const resolvedModel = await llm;
  const chain = smartSearchPromptTemplate.pipe(resolvedModel).pipe(new StringOutputParser());
  
  // 3. تمرير الـ currentUserName المضمونة والموجودة في أقواس الدالة فوق
  const answer = await chain.invoke({ 
    context, 
    question: query,
    currentUserName: currentUserName 
  } as any);

  return answer;
};