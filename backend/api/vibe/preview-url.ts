import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";

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
    const branch = await db.query.vibeBranches.findFirst({
      where: eq(schema.vibeBranches.userId, userId),
    });

    if (!branch) {
      return res.status(404).json({ error: "No branch found" });
    }

    const previewUrlBase = process.env.PREVIEW_URL_BASE || "https://crswlk";
    const branchSlug = branch.branchName.replace(/\//g, "-");
    const previewUrl = `${previewUrlBase}-git-${branchSlug}.vercel.app`;

    return res.json({ previewUrl, branch: branch.branchName });
  } catch (err) {
    console.error("Preview URL error:", err);
    return res.status(500).json({ error: "Failed to get preview URL" });
  }
}
