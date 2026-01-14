import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db";
import { createToken, verifyAppleToken } from "../_lib/auth";
import { cors } from "../_lib/cors";
import { generateUsername } from "../_lib/username";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { identityToken } = req.body;

    if (!identityToken) {
      return res.status(400).json({ message: "Identity token required" });
    }

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

    return res.json({
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
    return res.status(401).json({ message: "Authentication failed" });
  }
}
