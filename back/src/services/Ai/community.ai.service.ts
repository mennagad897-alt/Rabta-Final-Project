import mongoose from "mongoose";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import CommunityChunk from "../../models/AI/CommunityChunk.model";
import Community from "../../models/Community";
import Post from "../../models/Post";
import Message from "../../models/Message";
import { embeddingsModel } from "./core.ai.service";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import Job from "../../models/Job";
import http from "http";
import https from "https";
import fs from "fs/promises";
import path from "path";
import PDFParser from "pdf2json";


const fetchBuffer = (fileUrl: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(fileUrl);
    const client = urlObj.protocol === "https:" ? https : http;

    const request = client.get(urlObj, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(new Error(`Failed to fetch PDF: ${response.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });

    request.on("error", reject);
  });
};

// دالة مساعدة لاستخراج النص من الـ PDF
// دالة مساعدة لاستخراج النص من الـ PDF (تدعم Cloudinary والملفات المحلية)

export const extractTextFromPDF = async (fileUrl: string): Promise<string> => {
  return new Promise(async (resolve) => {
    try {
      let buffer: Buffer;

      if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
        const response = await fetch(fileUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        buffer = await fs.readFile(path.join(process.cwd(), fileUrl));
      }

      // تهيئة المكتبة الجديدة (true معناه استخراج النص الخام فقط)
      const pdfParser = new PDFParser(null, true);

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        console.error(`❌ PDF Parser Error:`, errData.parserError);
        resolve(""); // لو حصل إيرور نرجع نص فاضي عشان السيرفر ميقعش
      });

      pdfParser.on("pdfParser_dataReady", () => {
        const text = pdfParser.getRawTextContent();
        console.log("✅ PDF Text Extracted, Length:", text.length);
        resolve(text); // نرجع النص السليم
      });

      // تشغيل عملية القراءة على الملف
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error(`❌ Failed to fetch/parse PDF:`, error);
      resolve("");
    }
  });
};

// 1. دالة تجميع الداتا وتخزينها (Ingestion)
export const processCommunityKnowledge = async (communityId: string) => {
  const commId = new mongoose.Types.ObjectId(communityId);
  const community = await Community.findById(commId);
  if (!community) throw new Error("Community not found");

  const rawTexts: { text: string; metadata: any }[] = [];

  rawTexts.push({
    text: `Community Name: ${community.name}. Description: ${community.description}`,
    metadata: {
      sourceId: commId,
      sourceType: "community_info",
      timestamp: community.createdAt,
    },
  });

  if (community.chatId) {
    const messages = await Message.find({
      chatId: community.chatId,
      messageType: { $in: ["text", "file"] },
    }).populate("senderId", "fullName");
    // --- بداية الجزء الجراحي الجديد ---
    const messageItems = await Promise.all(
      messages.map(async (msg) => {
        let text = msg.content ? `${msg.content}\n` : "";

        // لو الرسالة عبارة عن ملف وفيها مرفقات
        if (
          msg.messageType === "file" &&
          msg.attachments &&
          msg.attachments.length > 0
        ) {
          for (const attachment of msg.attachments) {
            // لو الملف PDF
            if (
              attachment.fileType === "application/pdf" ||
              attachment.fileUrl.toLowerCase().endsWith(".pdf")
            ) {
              const pdfText = await extractTextFromPDF(attachment.fileUrl);
              text += `[محتوى ملف PDF مرفق]: \n${pdfText}\n`;
            }
          }
        }

        if (text.trim() === "") return null;

        return {
          text: `Message from ${(msg.senderId as any)?.fullName || "Unknown User"}: ${text}`,
          metadata: {
            sourceId: msg._id,
            sourceType: "community_info",
            senderId: (msg.senderId as any)?._id || null,
            timestamp: msg.createdAt,
          },
        };
      }),
    );

    // فلترة النصوص الفاضية وإضافتها
    const validMessageItems = messageItems.filter(
      (item): item is { text: string; metadata: any } => item !== null,
    );
    rawTexts.push(...validMessageItems);
  }

  const posts = await Post.find({ communityId: commId }).populate(
    "authorId",
    "fullName",
  );
  posts.forEach((post) => {
    const authorName = (post.authorId as any)?.fullName || "Unknown User";
    rawTexts.push({
      text: `Post by ${authorName}: ${post.content}`,
      metadata: {
        authorId: (post.authorId as any)?._id || null,
        sourceId: post._id,
        sourceType: "post",
        timestamp: post.createdAt,
      },
    });
  });

  // --- إضافة الوظائف (Jobs) للـ Knowledge Base ---
  const jobs = await Job.find({ communityId: commId }).populate(
    "authorId",
    "fullName",
  ); // لو الجوب مربوط بـ communityId
  jobs.forEach((job: any) => {
    const authorName = job.authorId?.fullName || "Unknown Recruiter";
    // تقدر تعدل الحقول دي (title, description) حسب المكتوب في موديل الـ Job عندك
    rawTexts.push({
      text: `Job Opportunity by ${authorName} - Title: ${job.title}. Description: ${job.description}. Requirements: ${job.requirements?.join(", ")}`,
      metadata: {
        authorId: job.authorId?._id || null,
        sourceId: job._id,
        sourceType: "job",
        timestamp: job.createdAt,
      },
    });
  });

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ["\n\n", "\n", ".", "!", "?", " "],
  });
  await CommunityChunk.deleteMany({ communityId: commId });

  for (const item of rawTexts) {
    const chunks = await splitter.splitText(item.text);
    if (chunks.length === 0) continue;

    const embeddings = await embeddingsModel.embedDocuments(chunks);

    const chunksToSave = chunks.map((chunk, index) => ({
      communityId: commId,
      content: chunk,
      embedding: embeddings[index],
      metadata: item.metadata,
    }));

    await CommunityChunk.insertMany(chunksToSave);
  }

  return { message: "Community data embedded and stored successfully" };
};

// 2. دالة البحث (Retrieval)
export const searchCommunityRAG = async (
  communityId: string,
  prompt: string,
  limit = 5,
) => {
  const queryEmbedding = await embeddingsModel.embedQuery(prompt);

  const results = await CommunityChunk.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: limit * 10,
        limit: limit,
        filter: { communityId: new mongoose.Types.ObjectId(communityId) },
      },
    },
    {
      $project: {
        _id: 0,
        content: 1,
        "metadata.sourceType": 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return results;
};

// تعريف الأداة (Tool) اللي الـ Agent هيستخدمها
export const createSearchTool = (communityId: string) => {
  return tool(
    async ({ query }) => {
      console.log(
        `--- Agent is searching for: "${query}" in community: ${communityId} ---`,
      );
      const results = await searchCommunityRAG(communityId, query);
      console.log("Database Search Results:", results);
      // تحويل النتائج لتكست بسيط الـ Agent يفهمه
      if (results.length === 0)
        return "No relevant information found in the community records.";

    // 🔥 خوارزمية الفلترة الذكية وإضافة الأسماء:
      return results
        .filter((r) => {
          // 1. استبعاد رسائل النظام الآلية (عشان نوفر توكنز ومتبوظش التلخيص)
          const text = r.content || "";
          const isSystemMessage = 
            text.includes("أضافتك إلى المجموعة") || 
            text.includes("انضم إلى") || 
            text.includes("غادر");
          
          return !isSystemMessage;
        })
        .map((r) => {
          // 2. تنظيف المسافات الزائدة
          const cleanContent = r.content.replace(/\s+/g, ' ').trim();
          
          // 3. لقط اسم المرسل الحقيقي من الميتاداتا
          let sender = "عضو في الجروب";
          if (r.metadata?.senderName && r.metadata.senderName !== "مستخدم في الشات") {
            sender = r.metadata.senderName;
          }

          // إرسال القالب النهائي للـ Agent شامل الاسم
          return `[Sender: ${sender} | Source: ${r.metadata?.sourceType || "chat"}]: ${cleanContent}`;
        })
        .join("\n"); 
    },
    {
      name: "search_community_knowledge",
      description:
        "Searches the community knowledge base including posts, chat messages, and info.",
      schema: z.object({
        query: z
          .string()
          .describe("The search query to look up in the community records."),
      }),
    },
  );
};
