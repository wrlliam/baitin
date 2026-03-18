import { redis } from "@/db/redis";

export async function checkCooldown(
  userId: string,
  key: string
): Promise<{ ok: boolean; expiresAt?: number }> {
  const redisKey = `econ:${key}:${userId}`;
  const val = await redis.get(redisKey);
  if (!val) return { ok: true };
  const expiresAt = parseInt(val);
  if (Date.now() >= expiresAt) return { ok: true };
  return { ok: false, expiresAt };
}

export async function setCooldown(
  userId: string,
  key: string,
  ttlSecs: number
): Promise<void> {
  const redisKey = `econ:${key}:${userId}`;
  const expiresAt = Date.now() + ttlSecs * 1000;
  await redis.set(redisKey, expiresAt.toString());
  await redis.send("EXPIRE", [redisKey, ttlSecs.toString()]);
}
