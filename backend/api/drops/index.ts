import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../_lib/db";
import { verifyAuth } from "../_lib/auth";
import { cors } from "../_lib/cors";

type DropRangeType = "close" | "far" | "anywhere";
type EffectType = "none" | "confetti" | "rainbow" | "stars" | "spooky" | "gross" | "uhoh";

const VALID_RANGES: DropRangeType[] = ["close", "far", "anywhere"];
const VALID_EFFECTS: EffectType[] = ["none", "confetti", "rainbow", "stars", "spooky", "gross", "uhoh"];

const notExpiredFilter = sql`(${schema.drops.expiresAt} IS NULL OR ${schema.drops.expiresAt} > datetime('now'))`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method === "GET") {
    const radius = parseFloat((req.query.radius as string) || "1000");

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
          return { ...drop, highfiveCount: highfiveCount[0]?.count || 0 };
        })
      );

      return res.json(dropsWithHighfives);
    }

    const lat = parseFloat((req.query.lat as string) || "0");
    const lng = parseFloat((req.query.lng as string) || "0");
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
        sql`${schema.drops.latitude} BETWEEN ${lat - latDelta} AND ${lat + latDelta}
            AND ${schema.drops.longitude} BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
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
        return { ...drop, highfiveCount: highfiveCount[0]?.count || 0 };
      })
    );

    return res.json(dropsWithHighfives);
  }

  if (req.method === "POST") {
    const auth = await verifyAuth(req);
    if (!auth) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId } = auth;
    const {
      message,
      latitude,
      longitude,
      range = "close",
      effect = "none",
      expiresAt = null,
    } = req.body;

    if (!message?.trim() || message.length > 280) {
      return res.status(400).json({ message: "Invalid message" });
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ message: "Invalid coordinates" });
    }

    if (!VALID_RANGES.includes(range)) {
      return res.status(400).json({ message: "Invalid range" });
    }

    if (!VALID_EFFECTS.includes(effect)) {
      return res.status(400).json({ message: "Invalid effect" });
    }

    if (expiresAt && isNaN(Date.parse(expiresAt))) {
      return res.status(400).json({ message: "Invalid expiry date" });
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

    return res.json({
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
    });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
