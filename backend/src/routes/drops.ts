import { Hono } from "hono";
import { eq, sql, and } from "drizzle-orm";
import { db, schema } from "../db";
import { authMiddleware } from "../middleware/auth";
import {
  broadcastNewDrop,
  broadcastDeleteDrop,
  broadcastHighfive,
} from "../ws";

type DropRangeType = "close" | "far" | "anywhere";
type EffectType =
  | "none"
  | "confetti"
  | "rainbow"
  | "stars"
  | "spooky"
  | "gross"
  | "uhoh";
const VALID_RANGES: DropRangeType[] = ["close", "far", "anywhere"];
const VALID_EFFECTS: EffectType[] = [
  "none",
  "confetti",
  "rainbow",
  "stars",
  "spooky",
  "gross",
  "uhoh",
];
const DELETE_WINDOW_MS = 15 * 60 * 1000;

type Variables = {
  userId: string;
};

const drops = new Hono<{ Variables: Variables }>();

const notExpiredFilter = sql`(${schema.drops.expiresAt} IS NULL OR ${schema.drops.expiresAt} > datetime('now'))`;

drops.get("/", async (c) => {
  const radius = parseFloat(c.req.query("radius") || "1000");

  if (radius > 100000) {
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
      .where(notExpiredFilter)
      .orderBy(sql`${schema.drops.createdAt} DESC`)
      .limit(100);

    const dropsWithHighfives = await Promise.all(
      result.map(async (drop) => {
        const highfiveCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.highfives)
          .where(eq(schema.highfives.dropId, drop.id));
        return {
          ...drop,
          highfiveCount: highfiveCount[0]?.count || 0,
        };
      })
    );

    return c.json(dropsWithHighfives);
  }

  const lat = parseFloat(c.req.query("lat") || "0");
  const lng = parseFloat(c.req.query("lng") || "0");

  const latDelta = radius / 111000;
  const lngDelta = radius / (111000 * Math.cos((lat * Math.PI) / 180));

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
    .where(
      sql`${schema.drops.latitude} BETWEEN ${lat - latDelta} AND ${
        lat + latDelta
      }
          AND ${schema.drops.longitude} BETWEEN ${lng - lngDelta} AND ${
        lng + lngDelta
      }
          AND ${notExpiredFilter}`
    )
    .orderBy(sql`${schema.drops.createdAt} DESC`)
    .limit(100);

  const dropsWithHighfives = await Promise.all(
    result.map(async (drop) => {
      const highfiveCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.highfives)
        .where(eq(schema.highfives.dropId, drop.id));
      return {
        ...drop,
        highfiveCount: highfiveCount[0]?.count || 0,
      };
    })
  );

  return c.json(dropsWithHighfives);
});

drops.post("/", authMiddleware, async (c) => {
  const userId = (c as any).get("userId") as string;
  const {
    message,
    latitude,
    longitude,
    range = "close",
    effect = "none",
    expiresAt = null,
  } = await c.req.json<{
    message: string;
    latitude: number;
    longitude: number;
    range?: DropRangeType;
    effect?: EffectType;
    expiresAt?: string | null;
  }>();

  if (!message?.trim() || message.length > 280) {
    return c.json({ message: "Invalid message" }, 400);
  }

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return c.json({ message: "Invalid coordinates" }, 400);
  }

  if (!VALID_RANGES.includes(range)) {
    return c.json({ message: "Invalid range" }, 400);
  }

  if (!VALID_EFFECTS.includes(effect)) {
    return c.json({ message: "Invalid effect" }, 400);
  }

  if (expiresAt && isNaN(Date.parse(expiresAt))) {
    return c.json({ message: "Invalid expiry date" }, 400);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.insert(schema.drops).values({
    id,
    userId,
    message: message.trim(),
    latitude,
    longitude,
    range,
    effect,
    expiresAt,
    createdAt,
  });

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  const newDrop = {
    id,
    userId,
    message: message.trim(),
    latitude,
    longitude,
    range,
    effect,
    expiresAt,
    createdAt,
    userName: user?.name || null,
    highfiveCount: 0,
  };

  broadcastNewDrop(newDrop);

  return c.json(newDrop);
});

drops.get("/:id", async (c) => {
  const { id } = c.req.param();

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
    return c.json({ message: "Drop not found" }, 404);
  }

  const highfiveCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.highfives)
    .where(eq(schema.highfives.dropId, id));

  return c.json({
    ...result[0],
    highfiveCount: highfiveCount[0]?.count || 0,
  });
});

drops.delete("/:id", authMiddleware, async (c) => {
  const userId = (c as any).get("userId") as string;
  const id = c.req.param("id")!;

  const drop = await db.query.drops.findFirst({
    where: eq(schema.drops.id, id),
  });

  if (!drop) {
    return c.json({ message: "Drop not found" }, 404);
  }

  if (drop.userId !== userId) {
    return c.json({ message: "Not authorized" }, 403);
  }

  const createdAt = new Date(drop.createdAt).getTime();
  const now = Date.now();
  if (now - createdAt > DELETE_WINDOW_MS) {
    return c.json({ message: "Delete window expired (15 minutes)" }, 403);
  }

  await db.delete(schema.drops).where(eq(schema.drops.id, id));

  broadcastDeleteDrop(id);

  return c.json({ success: true });
});

drops.post("/:id/highfive", authMiddleware, async (c) => {
  const userId = (c as any).get("userId") as string;
  const dropId = c.req.param("id")!;

  const drop = await db.query.drops.findFirst({
    where: eq(schema.drops.id, dropId),
  });

  if (!drop) {
    return c.json({ message: "Drop not found" }, 404);
  }

  const existingHighfive = await db.query.highfives.findFirst({
    where: and(
      eq(schema.highfives.dropId, dropId),
      eq(schema.highfives.userId, userId)
    ),
  });

  if (existingHighfive) {
    return c.json({ message: "Already high-fived" }, 400);
  }

  const highfiveId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db.insert(schema.highfives).values({
    id: highfiveId,
    dropId,
    userId,
    createdAt,
  });

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

    const fromUser = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    broadcastHighfive({
      dropId,
      toUserId: drop.userId,
      fromUserId: userId,
      fromUserName: fromUser?.name || null,
      notificationId,
    });
  }

  const highfiveCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.highfives)
    .where(eq(schema.highfives.dropId, dropId));

  return c.json({
    success: true,
    highfiveCount: highfiveCount[0]?.count || 0,
  });
});

drops.delete("/:id/highfive", authMiddleware, async (c) => {
  const userId = (c as any).get("userId") as string;
  const dropId = c.req.param("id")!;

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

  return c.json({
    success: true,
    highfiveCount: highfiveCount[0]?.count || 0,
  });
});

drops.get("/:id/highfive", authMiddleware, async (c) => {
  const userId = (c as any).get("userId") as string;
  const dropId = c.req.param("id")!;

  const existingHighfive = await db.query.highfives.findFirst({
    where: and(
      eq(schema.highfives.dropId, dropId),
      eq(schema.highfives.userId, userId)
    ),
  });

  return c.json({ hasHighfived: !!existingHighfive });
});

export default drops;
