import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, and, isNull } from "drizzle-orm";
import { db, schema } from "../../_lib/db.js";
import { verifyAuth } from "../../_lib/auth.js";
import { cors } from "../../_lib/cors.js";
import { getDeploymentForBranch } from "../../_lib/vercel.js";

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
  const vibeId = req.query.id as string;

  try {
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

    const deploymentUrl = await getDeploymentForBranch(vibeData.branchName);

    if (deploymentUrl) {
      return res.json({
        previewUrl: deploymentUrl,
        branch: vibeData.branchName,
        source: "vercel-api",
      });
    }

    const repoOwner = process.env.GITHUB_REPO_OWNER || "jamelhammoud";
    const repoName = process.env.GITHUB_REPO_NAME || "crosswalk-vibed";
    const githubUrl = `https://github.com/${repoOwner}/${repoName}/tree/${encodeURIComponent(
      vibeData.branchName
    )}`;

    return res.json({
      previewUrl: githubUrl,
      branch: vibeData.branchName,
      source: "github-fallback",
      message:
        "No Vercel deployment found yet. Push a commit to trigger a preview.",
    });
  } catch (err) {
    console.error("Preview URL error:", err);
    return res.status(500).json({ error: "Failed to get preview URL" });
  }
}
