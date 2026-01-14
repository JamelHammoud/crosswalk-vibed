import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../../_lib/db";
import { verifyAuth } from "../../_lib/auth";
import { cors } from "../../_lib/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== "PATCH") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;
  const notificationId = req.query.id as string;

  const [notification] = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.id, notificationId));

  if (!notification) {
    return res.status(404).json({ error: "Notification not found" });
  }

  if (notification.userId !== userId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await db
    .update(schema.notifications)
    .set({ read: 1 })
    .where(eq(schema.notifications.id, notificationId));

  return res.json({ success: true });
}
