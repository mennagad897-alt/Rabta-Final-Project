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
// 1. Extract Text From PDF
// ==========================================
export const extractTextFromPDF = async (fileUrl: string): Promise<string> => {
  return new Promise(async (resolve) => {
    try {
      let buffer: Buffer;

      if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
        // شيلنا الـ User-Agent اللي كان بيعمل قلق مع بعض السيرفرات
        const response = await fetch(fileUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "application/pdf, application/json, text/plain, */*",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Cloud Storage responded with status: ${response.status}`,
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        buffer = await fs.readFile(path.join(process.cwd(), fileUrl));
      }

      const pdfParser = new PDFParser(null, true);
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        console.error(`❌ PDF Parser Error:`, errData.parserError);
        resolve("");
      });
      pdfParser.on("pdfParser_dataReady", () => {
        const text = pdfParser.getRawTextContent();
        resolve(text);
      });
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error(`❌ Failed to parse PDF from URL (${fileUrl}):`, error);
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
    if (msg.messageType === "file" && msg.attachments) {
      for (const attachment of msg.attachments) {
        if (
          attachment.fileType === "application/pdf" ||
          attachment.fileUrl.toLowerCase().endsWith(".pdf")
        ) {
          const pdfText = await extractTextFromPDF(attachment.fileUrl);
          text += `[Attached PDF Content]: \n${pdfText}\n`;
        }
      }
    }
    if (text.trim() === "") continue;
    rawTexts.push({
      text: `Message from ${(msg.senderId as any)?.fullName || "User"}: ${text}`,
      metadata: {
        sourceId: msg._id,
        sourceType: "chat",
        timestamp: msg.createdAt,
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
    // 👈 هنا بنصيغ السياق بحيث يقرأ الـ content (اللي جواه اسم اليوزر) والوقت من الـ metadata
    context = results
      .map((r: any) => {
        const time = r.metadata?.timestamp
          ? new Date(r.metadata.timestamp).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Unknown time";
        return `[Time: ${time}] - ${r.content}`;
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
// 5. Auto-Ingest Single Message (Real-time)
// ==========================================
export const autoIngestSingleMessage = async (
  messageDoc: any,
  senderName: string,
) => {
  try {
    const text = `Message from ${senderName}: ${messageDoc.content}\n`;
    const [embedding] = await embeddingsModel.embedDocuments([text]);

    // 🔥 الخدعة هنا: بنعمل الأوبجكت كـ any في متغير منفصل الأول
    const chunkData: any = {
      chatId: new mongoose.Types.ObjectId(messageDoc.chatId.toString()),
      content: text,
      embedding: embedding,
      metadata: {
        sourceId: new mongoose.Types.ObjectId(messageDoc._id.toString()),
        sourceType: "chat",
        timestamp: messageDoc.createdAt,
      },
    };

    // وبعدين نبعته للـ create
    await CommunityChunk.create(chunkData);

    console.log(`✅ Message auto-ingested for AI: ${messageDoc._id}`);
  } catch (error) {
    console.error("❌ Error auto-ingesting message:", error);
  }
};
