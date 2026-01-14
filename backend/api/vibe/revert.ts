import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";
import * as github from "../_lib/github.js";

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

  try {
    const branch = await db.query.vibeBranches.findFirst({
      where: eq(schema.vibeBranches.userId, userId),
    });

    if (!branch) {
      return res.status(404).json({ error: "No branch found" });
    }

    await github.resetBranchToMain(branch.branchName);

    await db
      .update(schema.vibeBranches)
      .set({ hasChanges: 0, lastSyncAt: new Date().toISOString() })
      .where(eq(schema.vibeBranches.userId, userId));

    return res.json({ success: true, message: "Branch reset to production" });
  } catch (err) {
    console.error("Revert error:", err);
    return res.status(500).json({ error: "Failed to revert" });
  }
}
