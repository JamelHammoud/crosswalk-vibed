import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";
import { getDeploymentForBranch } from "../_lib/vercel.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("=== preview-url handler called ===");

  if (cors(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;
  console.log("User ID:", userId);

  // Log env vars (just existence, not values)
  console.log("VERCEL_TOKEN set:", !!process.env.VERCEL_TOKEN);
  console.log("VERCEL_PROJECT_ID set:", !!process.env.VERCEL_PROJECT_ID);
  console.log("VERCEL_TEAM_ID set:", !!process.env.VERCEL_TEAM_ID);

  try {
    const branch = await db.query.vibeBranches.findFirst({
      where: eq(schema.vibeBranches.userId, userId),
    });

    console.log("Branch found:", branch?.branchName || "none");

    if (!branch) {
      return res.status(404).json({ error: "No branch found" });
    }

    // Try to get actual deployment URL from Vercel API
    console.log("Calling getDeploymentForBranch...");
    const deploymentUrl = await getDeploymentForBranch(branch.branchName);
    console.log("Deployment URL result:", deploymentUrl);

    if (deploymentUrl) {
      return res.json({
        previewUrl: deploymentUrl,
        branch: branch.branchName,
        source: "vercel-api",
      });
    }

    // Fallback to GitHub branch URL if no deployment found
    const repoOwner = process.env.GITHUB_REPO_OWNER || "jamelhammoud";
    const repoName = process.env.GITHUB_REPO_NAME || "crosswalk-vibed";
    const githubUrl = `https://github.com/${repoOwner}/${repoName}/tree/${encodeURIComponent(
      branch.branchName
    )}`;

    console.log("Falling back to GitHub URL");
    return res.json({
      previewUrl: githubUrl,
      branch: branch.branchName,
      source: "github-fallback",
      message:
        "No Vercel deployment found yet. Push a commit to trigger a preview.",
    });
  } catch (err) {
    console.error("Preview URL error:", err);
    return res.status(500).json({ error: "Failed to get preview URL" });
  }
}
