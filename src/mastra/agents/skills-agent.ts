import { Agent } from "@mastra/core/agent";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { AgentSkills } from "../../skills-plugin.js";
import { readExcelTool } from "../tools/read-excel.js";
import { readPdfTool } from "../tools/read-pdf.js";

// mastra dev はバンドル時に cwd が変わるため、このファイルからの相対パスで解決する
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const skills = new AgentSkills([
  resolve(PROJECT_ROOT, "src/skills"),                              // リポジトリ内スキル
  resolve(PROJECT_ROOT, ".skills"),                                 // プロジェクトローカルスキル
  ...(process.env.SKILLS_DIR ? [process.env.SKILLS_DIR] : []),     // 環境変数で追加
]);

export const skillsAgent = new Agent({
  id: "skills-agent",
  name: "skills-agent",
  model: "anthropic/claude-sonnet-4-6",

  // Dynamic instructions: リクエストごとにスキルメタデータを注入
  instructions: () => `
あなたは汎用AIエージェントです。
タスクに応じて専門スキルを呼び出して対応します。

${skills.getSystemPromptInjection()}
`.trim(),

  tools: {
    skills: skills.createSkillsTool(),
    read_excel: readExcelTool,
    read_pdf: readPdfTool,
  },
});
