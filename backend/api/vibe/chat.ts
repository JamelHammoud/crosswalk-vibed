import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";
import * as github from "../_lib/github.js";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an AI coding assistant embedded in a mobile app called "Crosswalk" - a location-based messaging app where users can "drop" messages at their physical location.

You have REAL tools to read and write files in the actual GitHub repository. When you make changes, they are committed to the user's personal branch.

The tech stack is:
- Frontend: React 19, TypeScript, Vite 7, Tailwind CSS v4, MapLibre GL JS, Zustand, Capacitor
- Backend: Bun, Hono, SQLite (bun:sqlite), Drizzle ORM, WebSockets

Key directories:
- frontend/src/components/ - React components (MapView.tsx, DropComposer.tsx, MessageDrawer.tsx, etc.)
- frontend/src/services/ - API and utilities
- frontend/src/stores/ - Zustand stores
- frontend/src/constants/ - Theme colors, effects, ranges
- backend/src/routes/ - API routes
- backend/src/db/ - Database schema

IMPORTANT WORKFLOW:
1. When the user asks for a change, first use read_file to understand the current code
2. Make thoughtful changes that fit the existing code style
3. Use write_file to save changes - they go directly to GitHub
4. Explain what you changed and why

Be conversational and creative! Help users build cool features for Crosswalk.`;

const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description:
      "Read the contents of a file from the repository. Use this to understand existing code before making changes.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The file path relative to the repo root, e.g. 'frontend/src/components/MapView.tsx'",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write or update a file in the repository. The change is committed to the user's branch.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path relative to the repo root",
        },
        content: {
          type: "string",
          description: "The complete new content for the file",
        },
        commit_message: {
          type: "string",
          description: "A short, descriptive commit message for this change",
        },
      },
      required: ["path", "content", "commit_message"],
    },
  },
  {
    name: "list_files",
    description: "List files in a directory to explore the codebase structure.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The directory path relative to repo root, e.g. 'frontend/src/components'",
        },
      },
      required: ["path"],
    },
  },
];

async function getOrCreateBranch(userId: string, userEmail: string | null) {
  const existing = await db.query.vibeBranches.findFirst({
    where: eq(schema.vibeBranches.userId, userId),
  });

  if (existing) {
    return existing;
  }

  const sanitizedEmail = (userEmail || userId)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
  const branchName = `vibe/${sanitizedEmail}`;

  await github.createBranch(branchName);

  const newBranch = {
    id: crypto.randomUUID(),
    userId,
    branchName,
    hasChanges: 0,
    lastSyncAt: null,
    createdAt: new Date().toISOString(),
  };

  await db.insert(schema.vibeBranches).values(newBranch);
  return newBranch;
}

async function getChatHistory(userId: string, limit = 20) {
  return db.query.vibeMessages.findMany({
    where: eq(schema.vibeMessages.userId, userId),
    orderBy: schema.vibeMessages.createdAt,
    limit,
  });
}

async function saveMessage(userId: string, role: string, content: string) {
  await db.insert(schema.vibeMessages).values({
    id: crypto.randomUUID(),
    userId,
    role,
    content,
    createdAt: new Date().toISOString(),
  });
}

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  branchName: string
): Promise<string> {
  switch (toolName) {
    case "read_file": {
      const path = toolInput.path as string;
      const file = await github.getFile(path, branchName);
      if (!file) {
        const mainFile = await github.getFile(path, "main");
        if (!mainFile) {
          return `File not found: ${path}`;
        }
        return mainFile.content;
      }
      return file.content;
    }

    case "write_file": {
      const path = toolInput.path as string;
      const content = toolInput.content as string;
      const commitMessage = toolInput.commit_message as string;

      const previewUrl = process.env.PREVIEW_URL_BASE || "https://crswlk";
      const branchSlug = branchName.replace(/\//g, "-");

      const result = await github.commitFiles(
        branchName,
        [{ path, content, action: "update" }],
        commitMessage
      );

      return `✅ Committed to GitHub!\nPath: ${path}\nCommit: ${result.sha.slice(
        0,
        7
      )}\nView commit: ${
        result.url
      }\n\n🔗 Preview your changes: ${previewUrl}-git-${branchSlug}.vercel.app`;
    }

    case "list_files": {
      const path = toolInput.path as string;
      const files = await github.listFiles(path, branchName);
      if (files.length === 0) {
        return `No files found in: ${path}`;
      }
      return files
        .map((f) => `${f.type === "dir" ? "📁" : "📄"} ${f.name}`)
        .join("\n");
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    const branch = await getOrCreateBranch(userId, user?.email || null);
    const history = await getChatHistory(userId);

    await saveMessage(userId, "user", message);

    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    messages.push({ role: "user", content: message });

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    let fullResponse = "";
    const toolResults: string[] = [];

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await handleToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          branch.branchName
        );
        toolResults.push(`[${toolUse.name}] ${result.slice(0, 200)}...`);
        toolResultContents.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResultContents });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });
    }

    for (const block of response.content) {
      if (block.type === "text") {
        fullResponse += block.text;
      }
    }

    await saveMessage(userId, "assistant", fullResponse);

    let comparison = { aheadBy: 0, behindBy: 0, files: [] as string[] };
    try {
      comparison = await github.getBranchComparison(branch.branchName);
    } catch (err) {
      console.error("Failed to get branch comparison:", err);
    }

    return res.json({
      message: fullResponse,
      toolsUsed: toolResults,
      branchStatus: {
        branch: branch.branchName,
        hasChanges: comparison.aheadBy > 0,
        changedFiles: comparison.files,
        aheadBy: comparison.aheadBy,
      },
    });
  } catch (err) {
    console.error("Claude API error:", err);
    return res.status(500).json({ error: "Failed to get AI response" });
  }
}
