import mongoose from "mongoose";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import CommunityChunk from "../../models/CommunityChunk.model";
import Community from "../../models/Community";
import Post from "../../models/Post";
import Message from "../../models/Message";
import { embeddingsModel } from "./core.ai.service";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import Job from "../../models/Job";

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
      messageType: "text",
    }).populate("senderId", "fullName");
    messages.forEach((msg) => {
      const senderName = (msg.senderId as any)?.fullName || "Unknown User";
      rawTexts.push({
        text: `${senderName} said: ${msg.content}`,
        metadata: {
          authorId: (msg.senderId as any)?._id || null,
          sourceId: msg._id,
          sourceType: "chat",
          timestamp: msg.createdAt,
        },
      });
    });
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

      // تحويل النتائج لتكست بسيط الـ Agent يفهمه
      if (results.length === 0)
        return "No relevant information found in the community records.";

      return results
        .map((r) => `[Source: ${r.metadata.sourceType}]: ${r.content}`)
        .join("\n\n");
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
