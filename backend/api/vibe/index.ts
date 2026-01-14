import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql, isNull, and } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";
import * as github from "../_lib/github.js";

async function createVibe(userId: string, userEmail: string | null, name: string) {
  const sanitizedEmail = (userEmail || userId)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);

  const timestamp = Date.now().toString(36);
  const branchName = `vibe/${sanitizedEmail}-${timestamp}`;

  await github.createBranch(branchName);

  const vibeId = crypto.randomUUID();
  const newVibe = {
    id: vibeId,
    userId,
    name,
    branchName,
    createdAt: new Date().toISOString(),
  };

  await db.insert(schema.vibes).values(newVibe);
  return newVibe;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;

  if (req.method === "GET") {
    const userVibes = await db
      .select()
      .from(schema.vibes)
      .where(and(eq(schema.vibes.userId, userId), isNull(schema.vibes.deletedAt)))
      .orderBy(sql`${schema.vibes.createdAt} DESC`)
      .all();

    const vibesWithStatus = await Promise.all(
      userVibes.map(async (v) => {
        let comparison = { aheadBy: 0, behindBy: 0, files: [] as string[] };
        try {
          comparison = await github.getBranchComparison(v.branchName);
        } catch (err) {
          console.error("Failed to get branch comparison:", err);
        }
        return {
          ...v,
          hasChanges: comparison.aheadBy > 0,
          changedFiles: comparison.files,
          aheadBy: comparison.aheadBy,
        };
      })
    );

    return res.json({ vibes: vibesWithStatus });
  }

  if (req.method === "POST") {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    const newVibe = await createVibe(userId, user?.email || null, name.trim());
    return res.json(newVibe);
  }

  return res.status(405).json({ message: "Method not allowed" });
}
