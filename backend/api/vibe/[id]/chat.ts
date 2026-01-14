import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, and, isNull } from "drizzle-orm";
import { db, schema } from "../../_lib/db.js";
import { verifyAuth } from "../../_lib/auth.js";
import * as github from "../../_lib/github.js";
import { getDeploymentStatus } from "../../_lib/vercel.js";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://player.scrns.io",
  "https://server.scrns.io",
  "https://crswlk.vercel.app",
  "capacitor://localhost",
  "ionic://localhost",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (
    origin.includes("vercel.app") &&
    (origin.includes("crswlk") || origin.includes("crosswalk"))
  ) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

const SYSTEM_PROMPT = `You are an AI coding assistant for "Crosswalk" - a location-based messaging app.

You have tools to read and write files in the GitHub repository. Changes are committed to the user's branch.

Tech stack:
- Frontend: React 19, TypeScript, Vite 7, Tailwind CSS v4, MapLibre GL JS, Zustand, Capacitor
- Backend: Vercel serverless functions, SQLite (Turso), Drizzle ORM

EXISTING FILES (only import from these or create new ones):
Components: MapView.tsx, DropComposer.tsx, MessageDrawer.tsx, ProfileDrawer.tsx, ActivityView.tsx, AuthScreen.tsx, ClusterModal.tsx, DropMarker.tsx, EmojiExplosion.tsx, VibeChat.tsx
Stores: app.ts (THE ONLY STORE - add new state here, don't create new store files)
Services: api.ts, distance.ts, pusher.ts

AVAILABLE PACKAGES (ONLY these - nothing else):
- react, react-dom
- zustand
- maplibre-gl
- pusher-js
- @capacitor/*
- tailwindcss (classes only, no imports)

⛔ BUILD WILL FAIL IF YOU:
- Import a package not listed above (no react-hot-toast, framer-motion, lodash, axios, etc.)
- Import a file that doesn't exist (no ../stores/locationStore, no ./utils, etc.)
- Reference a component that doesn't exist

✅ INSTEAD:
- Add new state to the existing app.ts store
- Create new components as separate files
- Use CSS/Tailwind for animations
- Build custom UI instead of importing libraries

ONE-SHOT EDITS:
1. Call read_file AND write_file in the SAME response
2. Make ALL tool calls at once
3. After tools complete, briefly summarize changes

RULES:
- ONLY import existing files or packages listed above
- If you need new functionality, add to existing files or create new ones
- ALWAYS write_file in same response as read_file
- Be creative within these constraints!`;

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

async function getChatHistory(vibeId: string, limit = 20) {
  return db
    .select()
    .from(schema.vibeMessages)
    .where(
      and(
        eq(schema.vibeMessages.vibeId, vibeId),
        isNull(schema.vibeMessages.deletedAt)
      )
    )
    .orderBy(schema.vibeMessages.createdAt)
    .limit(limit)
    .all();
}

async function saveMessage(
  vibeId: string,
  userId: string,
  role: string,
  content: string
) {
  await db.insert(schema.vibeMessages).values({
    id: crypto.randomUUID(),
    vibeId,
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

      const result = await github.commitFiles(
        branchName,
        [{ path, content, action: "update" }],
        commitMessage
      );

      return `✅ Committed!\nPath: ${path}\nCommit: ${result.sha.slice(0, 7)}`;
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
  const origin = req.headers.origin as string | undefined;
  const allowedOrigin = getAllowedOrigin(origin);

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;
  const vibeId = req.query.id as string;
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const vibeData = await db
    .select()
    .from(schema.vibes)
    .where(
      and(
        eq(schema.vibes.id, vibeId),
        eq(schema.vibes.userId, userId),
        isNull(schema.vibes.deletedAt)
      )
    )
    .get();

  if (!vibeData) {
    return res.status(404).json({ error: "Vibe not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const history = await getChatHistory(vibeId);
    await saveMessage(vibeId, userId, "user", message);

    // Filter out any empty messages from history (API requires non-empty content)
    const messages: Anthropic.MessageParam[] = history
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    messages.push({ role: "user", content: message });

    sendEvent("status", { message: "Thinking..." });

    let response = await anthropic.messages
      .stream({
        model: "claude-opus-4-20250514",
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      })
      .finalMessage();

    let fullResponse = "";
    const toolResults: string[] = [];
    let hasWrites = false;
    let loopCount = 0;
    const maxLoops = 20;

    while (response.stop_reason === "tool_use" && loopCount < maxLoops) {
      loopCount++;
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        console.log(
          "Warning: stop_reason is tool_use but no tool blocks found"
        );
        break;
      }

      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const input = toolUse.input as Record<string, unknown>;
        const path = (input.path as string) || "";

        sendEvent("tool_start", {
          tool: toolUse.name,
          path,
          message:
            toolUse.name === "read_file"
              ? `📖 Reading ${path.split("/").pop()}...`
              : toolUse.name === "write_file"
              ? `✏️ Writing ${path.split("/").pop()}...`
              : `📁 Listing ${path || "root"}...`,
        });

        let result: string;
        try {
          result = await handleToolCall(
            toolUse.name,
            input,
            vibeData.branchName
          );
        } catch (toolErr) {
          console.error(`Tool ${toolUse.name} failed:`, toolErr);
          result = `Error executing ${toolUse.name}: ${toolErr}`;
          sendEvent("tool_end", {
            tool: toolUse.name,
            success: false,
            message: `❌ Failed: ${toolUse.name}`,
          });
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
            is_error: true,
          });
          continue;
        }

        const writeSuccess =
          toolUse.name === "write_file" && result.includes("✅");
        if (writeSuccess) {
          hasWrites = true;
        }

        sendEvent("tool_end", {
          tool: toolUse.name,
          success: !result.includes("not found") && !result.includes("Error"),
          message: writeSuccess
            ? `✅ Saved ${path.split("/").pop()}`
            : toolUse.name === "read_file"
            ? `📖 Read ${path.split("/").pop()}`
            : `📁 Listed files`,
        });

        toolResults.push(`[${toolUse.name}] ${result.slice(0, 100)}...`);
        toolResultContents.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Only push assistant message if it has content
      if (response.content && response.content.length > 0) {
        messages.push({ role: "assistant", content: response.content });
      }
      messages.push({ role: "user", content: toolResultContents });

      sendEvent("status", { message: "Processing..." });

      try {
        response = await anthropic.messages
          .stream({
            model: "claude-opus-4-20250514",
            max_tokens: 16384,
            system: SYSTEM_PROMPT,
            tools,
            messages,
          })
          .finalMessage();
      } catch (apiErr) {
        console.error("Claude API error in tool loop:", apiErr);
        sendEvent("error", {
          message: "AI temporarily unavailable, please try again",
        });
        res.end();
        return;
      }
    }

    if (loopCount >= maxLoops) {
      console.warn("Tool loop hit max iterations");
    }

    console.log(
      `Tool loop completed after ${loopCount} iterations, stop_reason: ${response.stop_reason}`
    );

    // Extract text from final response
    for (const block of response.content) {
      if (block.type === "text") {
        fullResponse += block.text;
      }
    }

    // If Claude said it would make changes but didn't write anything, force it to continue
    const promisedChanges =
      /\b(now i('ll| will)|let me (now )?(update|add|modify|change|create)|i('ll| will) (now )?(update|add|modify|change|create))\b/i.test(
        fullResponse
      );

    if (promisedChanges && !hasWrites && loopCount < maxLoops) {
      console.log(
        "Claude promised changes but didn't write - forcing continuation"
      );
      sendEvent("status", { message: "Completing changes..." });

      // Build continuation messages
      const contMessages: Anthropic.MessageParam[] = [...messages];
      if (response.content.length > 0) {
        contMessages.push({ role: "assistant", content: response.content });
      }
      contMessages.push({
        role: "user",
        content:
          "You said you would make changes but didn't call write_file. Please use write_file NOW to make the changes you described. Do not explain - just write the file.",
      });

      try {
        let contResponse = await anthropic.messages
          .stream({
            model: "claude-opus-4-20250514",
            max_tokens: 16384,
            system: SYSTEM_PROMPT,
            tools,
            messages: contMessages,
          })
          .finalMessage();

        // Process any tool calls from continuation
        while (contResponse.stop_reason === "tool_use") {
          const toolBlocks = contResponse.content.filter(
            (block): block is Anthropic.ToolUseBlock =>
              block.type === "tool_use"
          );

          const contToolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolBlocks) {
            const input = toolUse.input as Record<string, unknown>;
            const path = (input.path as string) || "";

            sendEvent("tool_start", {
              tool: toolUse.name,
              path,
              message:
                toolUse.name === "write_file"
                  ? `✏️ Writing ${path.split("/").pop()}...`
                  : `📖 Reading ${path.split("/").pop()}...`,
            });

            try {
              const result = await handleToolCall(
                toolUse.name,
                input,
                vibeData.branchName
              );
              if (toolUse.name === "write_file" && result.includes("✅")) {
                hasWrites = true;
              }
              sendEvent("tool_end", {
                tool: toolUse.name,
                success: result.includes("✅") || !result.includes("Error"),
                message:
                  toolUse.name === "write_file" && result.includes("✅")
                    ? `✅ Saved ${path.split("/").pop()}`
                    : `📖 Read ${path.split("/").pop()}`,
              });
              toolResults.push(`[${toolUse.name}] ${result.slice(0, 100)}...`);
              contToolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: result,
              });
            } catch (err) {
              contToolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Error: ${err}`,
                is_error: true,
              });
            }
          }

          contMessages.push({
            role: "assistant",
            content: contResponse.content,
          });
          contMessages.push({ role: "user", content: contToolResults });

          contResponse = await anthropic.messages
            .stream({
              model: "claude-opus-4-20250514",
              max_tokens: 16384,
              system: SYSTEM_PROMPT,
              tools,
              messages: contMessages,
            })
            .finalMessage();
        }

        // Extract final text
        fullResponse = "";
        for (const block of contResponse.content) {
          if (block.type === "text") {
            fullResponse += block.text;
          }
        }
      } catch (contErr) {
        console.error("Continuation failed:", contErr);
      }
    }

    // If Claude didn't provide a response, create a simple one
    if (!fullResponse.trim()) {
      if (hasWrites) {
        fullResponse = "Done! I've made the changes you requested.";
      } else if (loopCount > 0) {
        fullResponse =
          "I've reviewed the code. Let me know what changes you'd like!";
      }
    }

    // Only save non-empty assistant messages
    if (fullResponse.trim().length > 0) {
      await saveMessage(vibeId, userId, "assistant", fullResponse);
    }

    let comparison = { aheadBy: 0, behindBy: 0, files: [] as string[] };
    try {
      comparison = await github.getBranchComparison(vibeData.branchName);
    } catch (err) {
      console.error("Failed to get branch comparison:", err);
    }

    sendEvent("done", {
      message: fullResponse,
      toolsUsed: toolResults,
      vibe: {
        ...vibeData,
        hasChanges: comparison.aheadBy > 0,
        changedFiles: comparison.files,
        aheadBy: comparison.aheadBy,
      },
    });

    if (hasWrites) {
      sendEvent("deployment", {
        state: "QUEUED",
        message: "🚀 Deployment queued...",
      });

      const pollDeployment = async () => {
        const maxAttempts = 30;
        let attempt = 0;
        let lastState = "";

        while (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 3000));
          attempt++;

          const status = await getDeploymentStatus(vibeData.branchName);

          if (status.state !== lastState) {
            lastState = status.state;

            if (status.state === "BUILDING") {
              sendEvent("deployment", {
                state: "BUILDING",
                message: "🔨 Building preview...",
              });
            } else if (status.state === "READY") {
              sendEvent("deployment", {
                state: "READY",
                message: "✅ Preview ready!",
                url: status.url,
              });
              break;
            } else if (status.state === "ERROR") {
              sendEvent("deployment", {
                state: "ERROR",
                message: "❌ Build failed",
              });
              break;
            }
          }
        }
      };

      await pollDeployment();
    }

    res.end();
  } catch (err) {
    console.error("Claude API error:", err);
    sendEvent("error", { message: "Failed to get AI response" });
    res.end();
  }
}
