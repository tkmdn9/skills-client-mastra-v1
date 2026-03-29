import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { load as yamlLoad } from "js-yaml";

interface SkillFrontmatter {
  name: string;
  description: string;
  "allowed-tools"?: string[];
}

interface Skill {
  name: string;
  description: string;
  instructions: string;
  resources: Record<string, string>;
}

function parseMd(raw: string): { frontmatter: SkillFrontmatter; body: string } {
  if (!raw.startsWith("---")) {
    return { frontmatter: { name: "", description: "" }, body: raw };
  }
  const parts = raw.split("---");
  const frontmatter = yamlLoad(parts[1]) as SkillFrontmatter;
  const body = parts.slice(2).join("---").trim();
  return { frontmatter, body };
}

function loadResources(skillDir: string): Record<string, string> {
  const resources: Record<string, string> = {};
  for (const sub of ["scripts", "references", "assets"]) {
    const subDir = join(skillDir, sub);
    if (!existsSync(subDir)) continue;
    for (const f of readdirSync(subDir)) {
      resources[`${sub}/${f}`] = readFileSync(join(subDir, f), "utf-8");
    }
  }
  return resources;
}

export class AgentSkills {
  private skills = new Map<string, Skill>();

  /**
   * @param skillsDirs スキルディレクトリのパス（複数可）
   *   後ろのパスほど優先度が高く、同名スキルは上書きされる
   *   例: ["src/skills", ".skills", process.env.SKILLS_DIR]
   */
  constructor(skillsDirs: string | string[] = "src/skills") {
    const dirs = Array.isArray(skillsDirs) ? skillsDirs : [skillsDirs];
    for (const dir of dirs) {
      this.loadDir(dir);
    }
  }

  private loadDir(skillsDir: string) {
    if (!existsSync(skillsDir)) return;

    const entries = readdirSync(skillsDir, { withFileTypes: true }).filter(
      (d: import("fs").Dirent) => d.isDirectory()
    );

    for (const entry of entries) {
      const skillFile = join(skillsDir, entry.name, "SKILL.md");
      if (!existsSync(skillFile)) continue;

      const raw = readFileSync(skillFile, "utf-8");
      const { frontmatter, body } = parseMd(raw);

      // 後から読み込んだスキルが同名の既存スキルを上書き
      this.skills.set(frontmatter.name, {
        name: frontmatter.name,
        description: frontmatter.description,
        instructions: body,
        resources: loadResources(join(skillsDir, entry.name)),
      });
    }
  }

  /** Discovery: システムプロンプトに注入するXMLメタデータを生成 */
  getSystemPromptInjection(): string {
    const items = [...this.skills.values()]
      .map((s) => `  <skill name="${s.name}">${s.description}</skill>`)
      .join("\n");
    return [
      "<available_skills>",
      items,
      "</available_skills>",
      "タスクにスキルが必要な場合は skills ツールを呼び出してください。",
    ].join("\n");
  }

  /** Activation: Mastra createTool でスキルツールを生成 */
  createSkillsTool() {
    const skills = this.skills;

    return createTool({
      id: "skills",
      description:
        "スキルを有効化して詳細な指示とリソースを取得する。タスクに必要なスキルがある場合に呼び出す。",
      inputSchema: z.object({
        name: z.string().describe("有効化するスキル名"),
      }),
      execute: async ({ name }) => {
        const skill = skills.get(name);
        if (!skill) {
          return {
            error: `スキル '${name}' は見つかりません。利用可能: ${[...skills.keys()].join(", ")}`,
          };
        }

        let content = `# ${skill.name}\n\n${skill.instructions}`;
        if (Object.keys(skill.resources).length > 0) {
          content += "\n\n## リソースファイル\n";
          for (const [path, body] of Object.entries(skill.resources)) {
            content += `\n### ${path}\n${body}\n`;
          }
        }
        return { content };
      },
    });
  }

  getSkillNames(): string[] {
    return [...this.skills.keys()];
  }
}
