import mongoose, { Schema, Document } from "mongoose";

export interface IAgentLog extends Document {
  userId?: mongoose.Types.ObjectId;
  agentType: string; // مثلاً: 'CommunityAgent', 'JobAgent'
  query: string;
  response: string;
  timestamp: Date;
}

const AgentLogSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User" }, // ممكن يكون null لو يوزر مش مسجل
  agentType: { type: String, required: true },
  query: { type: String, required: true },
  response: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<IAgentLog>("AgentLog", AgentLogSchema);
