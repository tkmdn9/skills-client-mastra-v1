import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { existsSync, readFileSync } from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export const readPdfTool = createTool({
  id: "read_pdf",
  description: "PDFファイルのテキストを抽出して返す",
  inputSchema: z.object({
    file_path: z.string().describe("読み込むPDFファイルの絶対パスまたは相対パス"),
    max_pages: z
      .number()
      .optional()
      .default(0)
      .describe("抽出する最大ページ数（0 = 全ページ）"),
  }),
  execute: async ({ file_path, max_pages = 0 }) => {
    if (!existsSync(file_path)) {
      return { error: `ファイルが見つかりません: ${file_path}` };
    }

    const buffer = readFileSync(file_path);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;

    const totalPages = pdf.numPages;
    const limit = max_pages === 0 ? totalPages : Math.min(max_pages, totalPages);

    let text = "";
    for (let i = 1; i <= limit; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      text += pageText + "\n";
    }

    return {
      file_path,
      total_pages: totalPages,
      extracted_pages: limit,
      text: text.trim(),
    };
  },
});
