import fs from "fs/promises";
import path from "path";
// @ts-ignore
import PDFParser from "pdf2json";
import mongoose from "mongoose";
import Message from "../../models/Message";
import Chat from "../../models/chat";
import CommunityChunk from "../../models/AI/CommunityChunk.model";
import { embeddingsModel, llm } from "./core.ai.service"; // 👈 استيراد المحركات من فايل يوسف الأساسي
import { chatAiPromptTemplate } from "./prompts.ai"; // 👈 استيراد الـ Prompt بالإنجليزي

// ==========================================
// 1. Extract Text From PDF (نسخة تشخيصية باللوجات)
// ==========================================
export const extractTextFromPDF = async (fileUrl: string): Promise<string> => {
  return new Promise(async (resolve) => {
    try {
      console.log("🔄 [AI Ingestion] محاولة جلب وقراءة ملف PDF من الرابط:", fileUrl);
      let buffer: Buffer;

      if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
        const response = await fetch(fileUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "application/pdf, application/json, text/plain, */*",
          },
        });

        if (!response.ok) {
          console.error(`❌ [AI Ingestion] فشل جلب الملف من السيرفر. الحالة: ${response.status}`);
          throw new Error(`Cloud Storage responded with status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        console.log(`📦 [AI Ingestion] تم تحميل الملف بنجاح. حجم البافر: ${buffer.length} بايت`);
      } else {
        buffer = await fs.readFile(path.join(process.cwd(), fileUrl));
      }

      const pdfParser = new PDFParser(null, true);
      
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        console.error(`❌ [AI Ingestion] خطأ في مكتبة PDF Parser:`, errData.parserError);
        resolve("");
      });

      pdfParser.on("pdfParser_dataReady", () => {
        const text = pdfParser.getRawTextContent();
        console.log(`🎯 [AI Ingestion] تم استخراج النص بنجاح! طول النص المستخرج: ${text?.trim()?.length || 0} حرف.`);
        resolve(text);
      });

      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error(`❌ [AI Ingestion] فشل كامل في معالجة الملف (${fileUrl}):`, error);
      resolve("");
    }
  });
};
// ==========================================
// 2. Ingest Chat Data (Messages & PDFs)
// ==========================================
export const ingestChatData = async (chatId: string) => {
  const chatObjId = new mongoose.Types.ObjectId(chatId);
  const chatDoc = await Chat.findById(chatObjId);
  if (!chatDoc) throw new Error("Chat not found");

  const rawTexts: { text: string; metadata: any }[] = [];

  const messages = await Message.find({
    chatId: chatObjId,
    messageType: { $in: ["text", "file"] },
  }).populate("senderId", "fullName");

  for (const msg of messages) {
    let text = msg.content ? `${msg.content}\n` : "";
    const isFile = msg.messageType === "file" || (msg.attachments && msg.attachments.length > 0);
    const senderName = (msg.senderId as any)?.fullName || "User";

    if (isFile) {
      const uploadTime = msg.createdAt ? new Date(msg.createdAt).toLocaleString("en-US") : "Unknown Date";
      text += `[System Note: A file/document was uploaded and sent by ${senderName} on ${uploadTime}].\n`;
      
      if (msg.attachments) {
        for (const attachment of msg.attachments) {
          if (
            attachment.fileType === "application/pdf" ||
            attachment.fileUrl.toLowerCase().endsWith(".pdf")
          ) {
            const pdfText = await extractTextFromPDF(attachment.fileUrl);
            if (pdfText.trim()) {
              text += `[Attached PDF Content from ${senderName}]: \n${pdfText}\n`;
            }
          }
        }
      }
    }
    if (text.trim() === "") continue;

    rawTexts.push({
      text: `Message from ${senderName}: ${text}`,
      metadata: {
        chatId: chatId.toString(),
        sourceId: msg._id.toString(),
        sourceType: isFile ? "file" : "chat",
        senderId: (msg.senderId as any)?._id?.toString() || msg.senderId?.toString(),
        timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        senderName: senderName
      },
    });
  }

  await CommunityChunk.deleteMany({ chatId: chatObjId });

  for (const item of rawTexts) {
    // 💡 بنقسم الكلام لفقرات صغيرة من غير ما نحتاج الـ TextSplitter الخارجي اللي كان ضارب إيرور
    const chunks = item.text.match(/[\s\S]{1,500}/g) || [];
    if (chunks.length === 0) continue;

    const embeddings = await embeddingsModel.embedDocuments(chunks);
    const chunksToSave = chunks.map((chunk, index) => ({
      chatId: chatObjId,
      content: chunk,
      embedding: embeddings[index],
      metadata: item.metadata,
    }));
    await CommunityChunk.insertMany(chunksToSave);
  }
  return { message: "Chat data processed successfully 🚀" };
};

// ==========================================
// 3. Search Chat RAG
// ==========================================
export const searchChatRAG = async (
  chatId: string,
  prompt: string,
  limit = 3,
) => {
  const queryEmbedding = await embeddingsModel.embedQuery(prompt);
  return await CommunityChunk.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: limit * 10,
        limit: limit,
        filter: { chatId: new mongoose.Types.ObjectId(chatId) },
      },
    },
    {
      $project: {
        _id: 0,
        content: 1,
        metadata: 1, // 👈 هنا خلينا الـ project يرجع الـ metadata كلها عشان نستفيد من الـ timestamp
      },
    },
  ]);
};

// ==========================================
// 4. Ask Chat AI (Short answers & English)
// ==========================================
export const askChatAi = async (
  chatId: string,
  question: string,
  currentUserName: string,
) => {
  const results = await searchChatRAG(chatId, question);
  let context = "No document context available.";

  if (results.length > 0) {
    context = results
      .map((r: any) => {
        const timestamp = r.metadata?.timestamp || r.createdAt || r.metadata?.createdAt;
        
        if (!r.metadata || !timestamp) {
          console.warn("⚠️ [AI Retrieval] Missing metadata or timestamp for chunk in Vector Search results:", JSON.stringify(r, null, 2));
        }

        const time = timestamp
          ? new Date(timestamp).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Unknown Date/Time";

        // Extracting metadata to make context explicitly clear
        const sourceType = r.metadata?.sourceType || "chat";
        const senderName = r.metadata?.senderName || "Unknown User";
        
        // Ensure PDF/File content is explicitly tagged if the embedding string missed it
        let contentStr = r.content;
        if (sourceType === "file" && !contentStr.includes("[Attached PDF")) {
          contentStr = `[Attached PDF from ${senderName}]: ${contentStr}`;
        }

        return `[Date/Time: ${time}] - ${contentStr}`;
      })
      .join("\n");
  }

  // استخدام الـ Prompt المنفصل بالإنجليزي
  const formattedPrompt = await chatAiPromptTemplate.format({
    chat_history: "",
    context: context,
    question: question,
    currentUserName: currentUserName,
  });

  const llmModel = await llm;
  const response = await llmModel.invoke(formattedPrompt);
  return response.content;
};

// ==========================================
// 5. Auto-Ingest Single Message (Real-time نسخة باللوجات)
// ==========================================
export const autoIngestSingleMessage = async (
  messageDoc: any,
  senderName: string,
) => {
  try {
    console.log(`📥 [AI Ingestion] تشغيل دالة التغذية الفورية للرسالة ID: ${messageDoc._id}`);
    console.log(`ℹ️ [AI Ingestion] نوع الرسالة: ${messageDoc.messageType} | عدد المرفقات: ${messageDoc.attachments?.length || 0}`);

    let text = messageDoc.content ? `Message from ${senderName}: ${messageDoc.content}\n` : "";
    const isFile = messageDoc.messageType === "file" || (messageDoc.attachments && messageDoc.attachments.length > 0);

    if (isFile) {
      const fallbackDate = messageDoc.createdAt ? new Date(messageDoc.createdAt) : new Date();
      const uploadTime = fallbackDate.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      text += `[System Note: A file/document was uploaded and sent by ${senderName} on ${uploadTime}].\n`;

      if (messageDoc.attachments) {
        for (const attachment of messageDoc.attachments) {
          console.log(`📎 [AI Ingestion] جاري فحص المرفق: ${attachment.fileUrl} | نوعه: ${attachment.fileType}`);
          
          if (
            attachment.fileType === "application/pdf" ||
            attachment.fileUrl?.toLowerCase().endsWith(".pdf")
          ) {
            const pdfText = await extractTextFromPDF(attachment.fileUrl);
            if (pdfText.trim()) {
              text += `[Attached PDF Content from ${senderName}]: \n${pdfText}\n`;
            } else {
              console.warn("⚠️ [AI Ingestion] تنبيه: النص المستخرج من ملف الـ PDF فارغ تماماً!");
            }
          }
        }
      }
    }

    if (!text.trim()) {
      console.log("🛑 [AI Ingestion] إلغاء العملية: لا يوجد نص أو محتوى صالح للأرشفة.");
      return;
    }

    const chunks = text.match(/[\s\S]{1,500}/g) || [];
    if (chunks.length === 0) return;

    console.log(`🧱 [AI Ingestion] جاري تقسيم النص إلى ${chunks.length} فقرات (Chunks) وعمل Embeddings...`);

    const embeddings = await embeddingsModel.embedDocuments(chunks);

    const chunksToSave = chunks.map((chunk, index) => ({
      chatId: new mongoose.Types.ObjectId(messageDoc.chatId.toString()),
      content: chunk,
      embedding: embeddings[index],
      metadata: {
        chatId: messageDoc.chatId.toString(),
        sourceId: new mongoose.Types.ObjectId(messageDoc._id.toString()),
        sourceType: isFile ? "file" : "chat",
        senderId: messageDoc.senderId.toString(),
        timestamp: messageDoc.createdAt || new Date(),
        senderName: senderName
      },
    }));

    await CommunityChunk.insertMany(chunksToSave);
    console.log(`✅ [AI Ingestion] تمت العملية بنجاح وتخزين البيانات في الـ Vector Store.`);
  } catch (error) {
    console.error("❌ [AI Ingestion] خطأ غير متوقع في دالة autoIngestSingleMessage:", error);
  }
};