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

// ─── Blackjack Daily Win Limit ────────────────────────────────────────────────

const MAX_BLACKJACK_WINS_PER_DAY = 3;

function getBlackjackWinKey(userId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `bj:wins:${userId}:${date}`;
}

function getTTLToMidnightSecs(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

export async function checkBlackjackWinLimit(userId: string): Promise<{ ok: boolean; wins: number }> {
  const key = getBlackjackWinKey(userId);
  const val = await redis.get(key);
  const wins = val ? parseInt(val) : 0;
  return { ok: wins < MAX_BLACKJACK_WINS_PER_DAY, wins };
}

export async function incrementBlackjackWins(userId: string): Promise<void> {
  const key = getBlackjackWinKey(userId);
  const newVal = Number(await redis.send("INCR", [key]));
  if (newVal === 1) {
    await redis.send("EXPIRE", [key, getTTLToMidnightSecs().toString()]);
  }
}
