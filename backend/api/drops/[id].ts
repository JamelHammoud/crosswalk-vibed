import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../_lib/db";
import { verifyAuth } from "../_lib/auth";
import { cors } from "../_lib/cors";

const DELETE_WINDOW_MS = 15 * 60 * 1000;
const notExpiredFilter = sql`(${schema.drops.expiresAt} IS NULL OR ${schema.drops.expiresAt} > datetime('now'))`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const id = req.query.id as string;

  if (req.method === "GET") {
    const result = await db
      .select({
        id: schema.drops.id,
        userId: schema.drops.userId,
        message: schema.drops.message,
        latitude: schema.drops.latitude,
        longitude: schema.drops.longitude,
        range: schema.drops.range,
        effect: schema.drops.effect,
        expiresAt: schema.drops.expiresAt,
        createdAt: schema.drops.createdAt,
        userName: schema.users.name,
      })
      .from(schema.drops)
      .leftJoin(schema.users, eq(schema.drops.userId, schema.users.id))
      .where(sql`${schema.drops.id} = ${id} AND ${notExpiredFilter}`)
      .limit(1);

    if (!result.length) {
      return res.status(404).json({ message: "Drop not found" });
    }

    const highfiveCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.highfives)
      .where(eq(schema.highfives.dropId, id));

    return res.json({
      ...result[0],
      highfiveCount: highfiveCount[0]?.count || 0,
    });
  }

  if (req.method === "DELETE") {
    const auth = await verifyAuth(req);
    if (!auth) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId } = auth;

    const drop = await db.query.drops.findFirst({
      where: eq(schema.drops.id, id),
    });

    if (!drop) {
      return res.status(404).json({ message: "Drop not found" });
    }

    if (drop.userId !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const createdAt = new Date(drop.createdAt).getTime();
    const now = Date.now();
    if (now - createdAt > DELETE_WINDOW_MS) {
      return res.status(403).json({ message: "Delete window expired (15 minutes)" });
    }

    await db.delete(schema.drops).where(eq(schema.drops.id, id));

    return res.json({ success: true });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
