import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { llm } from "./core.ai.service";
import { COMMUNITY_AGENT_PROMPT } from "./prompts.ai";
import { createSearchTool } from "./community.ai.service";

// دالة بتكريت Agent مخصص لكل مكالمة عشان نبعتله الـ communityId الصح
export const getCommunityAgent = async (communityId: string) => {
  const searchTool = createSearchTool(communityId);

  const resolvedModel = await llm;
  // نفس طريقتك بالظبط
  return createAgent({
    model: resolvedModel,
    systemPrompt: COMMUNITY_AGENT_PROMPT,
    checkpointer: new MemorySaver(),
    tools: [searchTool],
  });
};
