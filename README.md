# Mastra Agent Skills Client

[Strands Agent Skills 仕様](https://agentskills.io/specification) を参考に、[Mastra](https://mastra.ai/) フレームワーク上に実装した Skills システム。

エージェントが必要なスキルをオンデマンドで呼び出すことで、**システムプロンプトの肥大化を防ぎながら専門的なタスクを処理**できる。

---

## アーキテクチャ

### Skills の3フェーズ

```text
┌─────────────────────────────────────────────────────────┐
│  1. Discovery（発見）                                     │
│     起動時に SKILL.md のメタデータ（name / description）  │
│     だけを読み込み、XML としてシステムプロンプトに注入      │
│                                                          │
│  2. Activation（有効化）                                  │
│     LLM がタスクに必要と判断したとき skills ツールを呼ぶ   │
│     → SKILL.md の全文 + リソースファイルを返す            │
│                                                          │
│  3. Execution（実行）                                     │
│     受け取った指示に従い、専用ツール（read_excel 等）で    │
│     タスクを実行する                                      │
└─────────────────────────────────────────────────────────┘
```

### Mastra との統合

```text
                    ┌──────────────────────────────┐
                    │        Mastra Agent           │
                    │                               │
  ユーザー入力 ───▶ │  instructions()               │
                    │   └─ getSystemPromptInjection │◀── AgentSkills
                    │                               │     └─ SKILL.md x N
                    │  tools:                       │
                    │   ├─ skills       ←─────────────── Activation ツール
                    │   ├─ read_excel  ←─────────────── xlsx 読み取り
                    │   └─ read_pdf    ←─────────────── PDF テキスト抽出
                    └──────────────────────────────┘
```

`AgentSkills` クラスが Discovery と Activation の両フェーズを管理し、Mastra の `createTool` / `Agent` API に統合している。

---

## ディレクトリ構成

```text
.
├── src/
│   ├── skills-plugin.ts          # AgentSkills クラス（コアロジック）
│   │                             #   - 複数パスからの SKILL.md 読み込み
│   │                             #   - システムプロンプト注入用 XML 生成
│   │                             #   - Mastra createTool でスキルツール生成
│   │
│   ├── mastra/
│   │   ├── index.ts              # Mastra インスタンス登録
│   │   ├── agents/
│   │   │   └── skills-agent.ts   # Agent 定義（instructions / tools）
│   │   └── tools/
│   │       ├── read-excel.ts     # xlsx / xls / csv 読み取りツール
│   │       └── read-pdf.ts       # PDF テキスト抽出ツール
│   │
│   └── skills/                   # スキルディレクトリ（自動認識）
│       ├── code_reviewer/
│       │   └── SKILL.md          # コードレビュー指示書
│       ├── excel_reader/
│       │   └── SKILL.md          # Excel 分析指示書
│       └── pdf_processor/
│           ├── SKILL.md          # PDF 要約指示書
│           └── references/
│               └── output_format.md
│
├── .skills/                      # プロジェクトローカルスキル（.gitignore 対象）
├── sample-data/                  # テスト用サンプルファイル
│   ├── sales.xlsx
│   └── report.pdf
├── .env.example
├── package.json
└── tsconfig.json
```

---

## スキルの読み込み優先順位

後から読み込まれたパスのスキルが同名のスキルを**上書き**する。

| 優先度 | パス | 用途 |
| :---: | --- | --- |
| 低 | `src/skills/` | リポジトリ内スキル（git 管理・チーム共有） |
| 中 | `.skills/` | プロジェクトローカル（`.gitignore` 推奨） |
| 高 | `$SKILLS_DIR` | 環境変数で指定した外部ディレクトリ |

---

## セットアップ

### 必要環境

- Node.js 18+
- Anthropic API キー

### インストール

```bash
npm install
```

### 環境変数

```bash
cp .env.example .env
```

`.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...

# オプション: 外部スキルディレクトリ
# SKILLS_DIR=/Users/yourname/.skills
```

### 起動

```bash
npm run dev
```

Mastra Studio が `http://localhost:4111` で起動する。

---

## スキルの追加

`src/skills/` に新しいディレクトリと `SKILL.md` を置くだけで自動認識される。

```text
src/skills/my_skill/
└── SKILL.md
```

### SKILL.md フォーマット

```markdown
---
name: my_skill
description: このスキルが何をするかの一行説明（エージェントが判断に使う）
---

# スキル名

エージェントへの詳細な指示をここに記述する。
スキルが有効化されたときだけこの内容が LLM に渡される。
```

### リソースファイル

スキルディレクトリ内の以下のサブディレクトリにファイルを置くと、スキル有効化時に自動で読み込まれる。

| ディレクトリ | 用途 |
| --- | --- |
| `references/` | 参考ドキュメント・フォーマット仕様 |
| `scripts/` | スクリプト・チェックリスト |
| `assets/` | その他素材 |

---

## 組み込みスキル

| スキル名 | 説明 | 使用ツール |
| --- | --- | --- |
| `code_reviewer` | コードレビュー（品質・セキュリティ・パフォーマンス） | なし（LLM が直接判断） |
| `excel_reader` | Excel / CSV の読み取りと分析 | `read_excel` |
| `pdf_processor` | PDF のテキスト抽出と要約 | `read_pdf` |

---

## ビルド

```bash
npm run build   # TypeScript → dist/
```
