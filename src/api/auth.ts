import { createHmac } from "crypto";
import { env } from "@/env";

function verifyJWT(token: string): string | null {
  const secret = env.BOT_API_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;

  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  if (expected !== sig) return null;

  let decoded: { sub?: string; exp?: number };
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!decoded.sub) return null;
  if (!decoded.exp || Math.floor(Date.now() / 1000) > decoded.exp) return null;

  return decoded.sub;
}

type AuthOk = { ok: true; userId: string };
type AuthFail = { ok: false; error: string };

type SetLike = { status?: number | string | undefined };

/** Verify Bearer JWT. Returns userId on success, sets 401 and returns error on failure. */
export function requireAuth(
  authorization: string | undefined,
  set: SetLike,
): AuthOk | AuthFail {
  if (!authorization?.startsWith("Bearer ")) {
    set.status = 401;
    return { ok: false, error: "Missing or invalid Authorization header" };
  }
  const userId = verifyJWT(authorization.slice(7));
  if (!userId) {
    set.status = 401;
    return { ok: false, error: "Invalid or expired token" };
  }
  return { ok: true, userId };
}

/**
 * Verify JWT and enforce that sub === discordId in the URL.
 * Sets 403 if the token belongs to a different user.
 */
export function requireAuthForUser(
  authorization: string | undefined,
  discordId: string,
  set: SetLike,
): AuthOk | AuthFail {
  const auth = requireAuth(authorization, set);
  if (!auth.ok) return auth;
  if (auth.userId !== discordId) {
    set.status = 403;
    return { ok: false, error: "Forbidden" };
  }
  return auth;
}
