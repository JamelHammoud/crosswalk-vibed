import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  createToken,
  verifyAppleToken,
  authMiddleware,
} from "../middleware/auth";
import { generateUsername } from "../utils/username";

type Variables = {
  userId: string;
};

const auth = new Hono<{ Variables: Variables }>();

auth.post("/apple", async (c) => {
  const { identityToken } = await c.req.json<{
    identityToken: string;
    authorizationCode: string;
  }>();

  try {
    const appleUser = await verifyAppleToken(identityToken);

    let user = await db.query.users.findFirst({
      where: eq(schema.users.appleUserId, appleUser.sub),
    });

    if (!user) {
      const id = crypto.randomUUID();
      const username = generateUsername();
      await db.insert(schema.users).values({
        id,
        appleUserId: appleUser.sub,
        email: appleUser.email || null,
        name: username,
        createdAt: new Date().toISOString(),
      });
      user = await db.query.users.findFirst({
        where: eq(schema.users.id, id),
      });
    }

    const token = await createToken(user!.id);

    return c.json({
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        appleUserId: user!.appleUserId,
      },
      token,
    });
  } catch (err) {
    console.error("Apple auth error:", err);
    return c.json({ message: "Authentication failed" }, 401);
  }
});

auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    appleUserId: user.appleUserId,
  });
});

auth.patch("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { name } = await c.req.json<{ name?: string }>();

  if (name !== undefined) {
    if (name.length < 2 || name.length > 20) {
      return c.json({ message: "Username must be 2-20 characters" }, 400);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return c.json(
        { message: "Username can only contain letters, numbers, _ and -" },
        400
      );
    }
  }

  await db
    .update(schema.users)
    .set({ name: name || null })
    .where(eq(schema.users.id, userId));

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  return c.json({
    id: user!.id,
    email: user!.email,
    name: user!.name,
    appleUserId: user!.appleUserId,
  });
});

auth.post("/me/generate-username", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const newUsername = generateUsername();

  await db
    .update(schema.users)
    .set({ name: newUsername })
    .where(eq(schema.users.id, userId));

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  return c.json({
    id: user!.id,
    email: user!.email,
    name: user!.name,
    appleUserId: user!.appleUserId,
  });
});

export default auth;
