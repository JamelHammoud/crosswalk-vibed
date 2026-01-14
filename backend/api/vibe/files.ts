import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";
import * as github from "../_lib/github.js";

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
  const path = (req.query.path as string) || "";

  try {
    const branch = await db.query.vibeBranches.findFirst({
      where: eq(schema.vibeBranches.userId, userId),
    });

    const branchName = branch?.branchName || "main";
    const files = await github.listFiles(path, branchName);

    return res.json({ files });
  } catch (err) {
    console.error("List files error:", err);
    return res.status(500).json({ error: "Failed to list files" });
  }
}
