import { Context, Next } from "hono";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const secret = new TextEncoder().encode(JWT_SECRET);

export interface AuthContext {
  userId: string;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    c.set("userId", payload.sub as string);
    await next();
  } catch {
    return c.json({ message: "Invalid token" }, 401);
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
