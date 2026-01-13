import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { notifications, users, drops } from "../db/schema";
import { authMiddleware } from "../middleware/auth";

type Variables = {
  userId: string;
};

const app = new Hono<{ Variables: Variables }>();

app.use("/*", authMiddleware);

app.get("/", async (c) => {
  const userId = c.get("userId");

  const userNotifications = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      dropId: notifications.dropId,
      fromUserId: notifications.fromUserId,
      fromUserName: users.name,
      read: notifications.read,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.fromUserId, users.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return c.json(
    userNotifications.map((n) => ({
      ...n,
      read: n.read === 1,
    }))
  );
});

app.get("/unread-count", async (c) => {
  const userId = c.get("userId");

  const result = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));

  return c.json({ count: result.length });
});

app.patch("/:id/read", async (c) => {
  const userId = c.get("userId");
  const notificationId = c.req.param("id");

  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId));

  if (!notification) {
    return c.json({ error: "Notification not found" }, 404);
  }

  if (notification.userId !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  await db
    .update(notifications)
    .set({ read: 1 })
    .where(eq(notifications.id, notificationId));

  return c.json({ success: true });
});

app.post("/read-all", async (c) => {
  const userId = c.get("userId");

  await db
    .update(notifications)
    .set({ read: 1 })
    .where(eq(notifications.userId, userId));

  return c.json({ success: true });
});

export default app;
