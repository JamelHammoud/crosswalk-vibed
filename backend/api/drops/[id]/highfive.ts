import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, and, sql } from "drizzle-orm";
import { db, schema } from "../../_lib/db";
import { verifyAuth } from "../../_lib/auth";
import { cors } from "../../_lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;
  const dropId = req.query.id as string;

  if (req.method === "POST") {
    const drop = await db.query.drops.findFirst({
      where: eq(schema.drops.id, dropId),
    });

    if (!drop) {
      return res.status(404).json({ message: "Drop not found" });
    }

    const existingHighfive = await db.query.highfives.findFirst({
      where: and(
        eq(schema.highfives.dropId, dropId),
        eq(schema.highfives.userId, userId)
      ),
    });

    if (existingHighfive) {
      return res.status(400).json({ message: "Already high-fived" });
    }

    const highfiveId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db.insert(schema.highfives).values({
      id: highfiveId,
      dropId,
      userId,
      createdAt,
    });

    // Create notification for drop owner
    if (drop.userId !== userId) {
      const notificationId = crypto.randomUUID();
      await db.insert(schema.notifications).values({
        id: notificationId,
        userId: drop.userId,
        type: "highfive",
        dropId,
        fromUserId: userId,
        createdAt,
      });
    }

    const highfiveCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.highfives)
      .where(eq(schema.highfives.dropId, dropId));

    return res.json({
      success: true,
      highfiveCount: highfiveCount[0]?.count || 0,
    });
  }

  if (req.method === "DELETE") {
    await db
      .delete(schema.highfives)
      .where(
        and(
          eq(schema.highfives.dropId, dropId),
          eq(schema.highfives.userId, userId)
        )
      );

    const highfiveCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.highfives)
      .where(eq(schema.highfives.dropId, dropId));

    return res.json({
      success: true,
      highfiveCount: highfiveCount[0]?.count || 0,
    });
  }

  if (req.method === "GET") {
    const existingHighfive = await db.query.highfives.findFirst({
      where: and(
        eq(schema.highfives.dropId, dropId),
        eq(schema.highfives.userId, userId)
      ),
    });

    return res.json({ hasHighfived: !!existingHighfive });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
