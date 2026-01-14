import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const secret = new TextEncoder().encode(JWT_SECRET);

export async function verifyAuth(
  req: VercelRequest
): Promise<{ userId: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return { userId: payload.sub as string };
  } catch {
    return null;
  }
}

export async function createToken(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyAppleToken(
  identityToken: string
): Promise<{ sub: string; email?: string }> {
  const JWKS = jose.createRemoteJWKSet(
    new URL("https://appleid.apple.com/auth/keys")
  );

  const { payload } = await jose.jwtVerify(identityToken, JWKS, {
    issuer: "https://appleid.apple.com",
    audience: ["com.crosswalk.app", "com.crosswalk.app.web"],
  });

  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
  };
}

export function requireAuth(
  handler: (
    req: VercelRequest,
    res: VercelResponse,
    auth: { userId: string }
  ) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const auth = await verifyAuth(req);
    if (!auth) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return handler(req, res, auth);
  };
}
