import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cors } from "./_lib/cors.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  res.json({ status: "ok", name: "Crosswalk API" });
}
