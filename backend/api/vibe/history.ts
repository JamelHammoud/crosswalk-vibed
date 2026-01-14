import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db.js";
import { verifyAuth } from "../_lib/auth.js";
import { cors } from "../_lib/cors.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;

  try {
    await db
      .delete(schema.vibeMessages)
      .where(eq(schema.vibeMessages.userId, userId));

    return res.json({ success: true });
  } catch (err) {
    console.error("Clear history error:", err);
    return res.status(500).json({ error: "Failed to clear history" });
  }
}
