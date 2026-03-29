import { Mastra } from "@mastra/core";
import { skillsAgent } from "./agents/skills-agent.js";

export const mastra = new Mastra({
  agents: { skillsAgent },
});
