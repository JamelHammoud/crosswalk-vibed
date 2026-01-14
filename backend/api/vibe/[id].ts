import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql, and, isNull } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";
import * as github from "../_lib/github.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;
  const vibeId = req.query.id as string;

  if (req.method === "GET") {
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

    let comparison = { aheadBy: 0, behindBy: 0, files: [] as string[] };
    try {
      comparison = await github.getBranchComparison(vibeData.branchName);
    } catch (err) {
      console.error("Failed to get branch comparison:", err);
    }

    return res.json({
      ...vibeData,
      hasChanges: comparison.aheadBy > 0,
      changedFiles: comparison.files,
      aheadBy: comparison.aheadBy,
      behindBy: comparison.behindBy,
    });
  }

  if (req.method === "DELETE") {
    const vibeData = await db
      .select()
      .from(schema.vibes)
      .where(and(eq(schema.vibes.id, vibeId), eq(schema.vibes.userId, userId)))
      .get();

    if (!vibeData) {
      return res.status(404).json({ error: "Vibe not found" });
    }

    await db
      .update(schema.vibes)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(schema.vibes.id, vibeId));

    return res.json({ success: true });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
