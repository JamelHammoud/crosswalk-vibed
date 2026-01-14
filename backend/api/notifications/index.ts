import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, desc } from "drizzle-orm";
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

  const userNotifications = await db
    .select({
      id: schema.notifications.id,
      type: schema.notifications.type,
      dropId: schema.notifications.dropId,
      fromUserId: schema.notifications.fromUserId,
      fromUserName: schema.users.name,
      read: schema.notifications.read,
      createdAt: schema.notifications.createdAt,
    })
    .from(schema.notifications)
    .leftJoin(schema.users, eq(schema.notifications.fromUserId, schema.users.id))
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);

  return res.json(
    userNotifications.map((n) => ({
      ...n,
      read: n.read === 1,
    }))
  );
}
