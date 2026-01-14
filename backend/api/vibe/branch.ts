import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";
import * as github from "../_lib/github.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;

  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    const branch = await getOrCreateBranch(userId, user?.email || null);

    let comparison = { aheadBy: 0, behindBy: 0, files: [] as string[] };
    try {
      comparison = await github.getBranchComparison(branch.branchName);
    } catch (err) {
      console.error("Failed to get branch comparison:", err);
    }

    return res.json({
      branch: branch.branchName,
      hasChanges: comparison.aheadBy > 0,
      changedFiles: comparison.files,
      aheadBy: comparison.aheadBy,
      behindBy: comparison.behindBy,
      lastSync: branch.lastSyncAt,
    });
  } catch (err) {
    console.error("Vibe branch error:", err);
    return res.status(500).json({ message: "Failed to get branch status" });
  }
}
