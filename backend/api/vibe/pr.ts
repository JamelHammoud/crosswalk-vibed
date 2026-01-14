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
  const { title, body } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    const branch = await db.query.vibeBranches.findFirst({
      where: eq(schema.vibeBranches.userId, userId),
    });

    if (!branch) {
      return res.status(404).json({ error: "No branch found" });
    }

    const comparison = await github.getBranchComparison(branch.branchName);
    if (comparison.aheadBy === 0) {
      return res.status(400).json({ error: "No changes to submit" });
    }

    const prTitle = title || `Vibe changes from ${user?.name || "a user"}`;
    const prBody =
      body ||
      `Changes made via the "I wanna Vibe" feature.\n\nFiles changed:\n${comparison.files
        .map((f) => `- ${f}`)
        .join("\n")}`;

    const pr = await github.createPullRequest(branch.branchName, prTitle, prBody);

    return res.json({ prNumber: pr.number, prUrl: pr.url });
  } catch (err) {
    console.error("PR creation error:", err);
    return res.status(500).json({ error: "Failed to create PR" });
  }
}
