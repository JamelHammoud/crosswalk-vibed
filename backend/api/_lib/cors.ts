import type { VercelRequest, VercelResponse } from "@vercel/node";

function logRequest(req: VercelRequest, res: VercelResponse) {
  const start = Date.now();
  const method = req.method;
  const url = req.url;
  console.log(`<-- ${method} ${url}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`--> ${method} ${url} ${res.statusCode} ${duration}ms`);
  });
}

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://player.scrns.io",
  "https://server.scrns.io",
  "https://crswlk.vercel.app",
  "capacitor://localhost",
  "ionic://localhost",
];

export function cors(req: VercelRequest, res: VercelResponse): boolean {
  logRequest(req, res);
  const origin = req.headers.origin;

  // Check if origin is allowed
  let allowedOrigin = ALLOWED_ORIGINS[0];
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    } else if (
      origin.includes("vercel.app") &&
      (origin.includes("crswlk") || origin.includes("crosswalk"))
    ) {
      // Allow all Vercel preview deployments for crswlk or crosswalk projects
      allowedOrigin = origin;
    }
  }

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }

  return false;
}
