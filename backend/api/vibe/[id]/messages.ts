import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, and, isNull } from "drizzle-orm";
import { db, schema } from "../../_lib/db.js";
import { verifyAuth } from "../../_lib/auth.js";
import { cors } from "../../_lib/cors.js";

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

  const messages = await db
    .select()
    .from(schema.vibeMessages)
    .where(
      and(
        eq(schema.vibeMessages.vibeId, vibeId),
        isNull(schema.vibeMessages.deletedAt)
      )
    )
    .orderBy(schema.vibeMessages.createdAt)
    .all();

  return res.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
