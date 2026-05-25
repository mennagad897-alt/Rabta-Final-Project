import { llm } from "./core.ai.service";
import Job from "../../models/Job";
import { User } from "../../models/user";
import { jobMatchingPromptTemplate } from "./prompts.ai";

export const calculateMatchScore = async (
  jobId: string,
  freelancerId: string
): Promise<{ score: number; reason: string } | null> => {
  try {
    const job = await Job.findById(jobId).select("title description requiredSkills");
    const freelancer = await User.findById(freelancerId).select("fullName jobTitle bioHeadline aboutMe skills");

    if (!job || !freelancer) {
      console.warn("⚠️ [Job Matching] Job or Freelancer not found");
      return null;
    }

    const jobData = {
      title: job.title,
      description: job.description,
      requiredSkills: job.requiredSkills?.join(", ") || "Not specified"
    };

    const freelancerData = {
      title: freelancer.jobTitle || "Not specified",
      headline: freelancer.bioHeadline || "Not specified",
      about: freelancer.aboutMe || "Not specified",
      skills: freelancer.skills?.join(", ") || "Not specified"
    };

    const formattedPrompt = await jobMatchingPromptTemplate.format({
      jobTitle: jobData.title,
      jobDescription: jobData.description,
      jobSkills: jobData.requiredSkills,
      freelancerTitle: freelancerData.title,
      freelancerBio: freelancerData.about,
      freelancerSkills: freelancerData.skills
    });

    const llmModel = await llm;
    const response = await llmModel.invoke(formattedPrompt);
    
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    // Strip markdown code blocks (e.g. ```json ... ```)
    const cleanJsonStr = content.replace(/\`\`\`(?:json)?/g, "").replace(/\`\`\`/g, "").trim();

    const parsed = JSON.parse(cleanJsonStr);

    if (typeof parsed.score === 'number' && typeof parsed.reason === 'string') {
      return {
        score: parsed.score,
        reason: parsed.reason
      };
    }

    return null;
  } catch (error) {
    console.error("❌ Job Matching Error:", error);
    throw error;
  }
};
