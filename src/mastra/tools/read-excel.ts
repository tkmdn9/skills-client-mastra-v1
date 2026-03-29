import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { existsSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx") as typeof import("xlsx");

export const readExcelTool = createTool({
  id: "read_excel",
  description:
    "Excelファイル（.xlsx / .xls / .csv）を読み込み、シートの内容をJSON形式で返す",
  inputSchema: z.object({
    file_path: z.string().describe("読み込むファイルの絶対パスまたは相対パス"),
    sheet_name: z
      .string()
      .optional()
      .describe("読み込むシート名。省略時は最初のシートを読み込む"),
    max_rows: z
      .number()
      .optional()
      .default(100)
      .describe("取得する最大行数（デフォルト: 100）"),
  }),
  execute: async ({ file_path, sheet_name, max_rows = 100 }) => {
    if (!existsSync(file_path)) {
      return { error: `ファイルが見つかりません: ${file_path}` };
    }

    const workbook = XLSX.readFile(file_path);
    const targetSheet = sheet_name ?? workbook.SheetNames[0];

    if (!workbook.SheetNames.includes(targetSheet)) {
      return {
        error: `シート '${targetSheet}' が見つかりません。利用可能: ${workbook.SheetNames.join(", ")}`,
      };
    }

    const sheet = workbook.Sheets[targetSheet];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    const trimmed = rows.slice(0, max_rows);

    return {
      file_path,
      sheet_name: targetSheet,
      all_sheets: workbook.SheetNames,
      total_rows: rows.length,
      returned_rows: trimmed.length,
      data: trimmed,
    };
  },
});
