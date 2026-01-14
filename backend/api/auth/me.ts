import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../_lib/db";
import { verifyAuth, requireAuth } from "../_lib/auth";
import { cors } from "../_lib/cors";
import { generateUsername } from "../_lib/username";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;

  if (req.method === "GET") {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      appleUserId: user.appleUserId,
    });
  }

  if (req.method === "PATCH") {
    const { name } = req.body;

    if (name !== undefined) {
      if (name.length < 2 || name.length > 20) {
        return res.status(400).json({ message: "Username must be 2-20 characters" });
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return res.status(400).json({
          message: "Username can only contain letters, numbers, _ and -",
        });
      }
    }

    await db
      .update(schema.users)
      .set({ name: name || null })
      .where(eq(schema.users.id, userId));

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    return res.json({
      id: user!.id,
      email: user!.email,
      name: user!.name,
      appleUserId: user!.appleUserId,
    });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
