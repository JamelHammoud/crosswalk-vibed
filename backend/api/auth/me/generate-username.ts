import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "../../_lib/db";
import { verifyAuth } from "../../_lib/auth";
import { cors } from "../../_lib/cors";
import { generateUsername } from "../../_lib/username";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { userId } = auth;
  const newUsername = generateUsername();

  await db
    .update(schema.users)
    .set({ name: newUsername })
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
