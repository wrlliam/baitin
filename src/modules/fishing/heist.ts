import { redis } from "@/db/redis";
import { getOrCreateProfile, addCoins, subtractCoins } from "./economy";

const HEIST_CD_TTL = 7200; // 2 hours
const IMMUNE_TTL = 7200; // 2 hours

export function calculateHeistSuccess(participantCount: number): number {
  return Math.min(0.9, 0.3 + participantCount * 0.12);
}

export async function canJoinHeist(userId: string): Promise<{ ok: boolean; expiresAt?: number }> {
  const val = await redis.get(`heist:cd:${userId}`);
  if (!val) return { ok: true };
  return { ok: false, expiresAt: parseInt(val) };
}

export async function isHeistImmune(userId: string): Promise<{ immune: boolean; expiresAt?: number }> {
  const val = await redis.get(`heist:immune:${userId}`);
  if (!val) return { immune: false };
  return { immune: true, expiresAt: parseInt(val) };
}

export async function executeHeist(
  participants: string[],
  targetId: string,
): Promise<{
  success: boolean;
  stolen?: number;
  share?: number;
  fine?: number;
}> {
  const targetProfile = await getOrCreateProfile(targetId);

  const successChance = calculateHeistSuccess(participants.length);
  const success = Math.random() < successChance;

  const cdExpiresAt = Date.now() + HEIST_CD_TTL * 1000;
  const immuneExpiresAt = Date.now() + IMMUNE_TTL * 1000;

  // Set cooldowns for all participants
  for (const pid of participants) {
    await redis.send("SETEX", [`heist:cd:${pid}`, HEIST_CD_TTL.toString(), cdExpiresAt.toString()]);
  }

  // Set target immunity
  await redis.send("SETEX", [`heist:immune:${targetId}`, IMMUNE_TTL.toString(), immuneExpiresAt.toString()]);

  if (!success) {
    const fine = 200;
    for (const pid of participants) {
      await subtractCoins(pid, fine);
    }
    return { success: false, fine };
  }

  // Steal 10-20% of target coins, max 5000
  const stealPct = 0.1 + Math.random() * 0.1;
  const stolen = Math.min(5000, Math.max(100, Math.floor(targetProfile.coins * stealPct)));
  const share = Math.floor(stolen / participants.length);

  await subtractCoins(targetId, stolen);
  for (const pid of participants) {
    await addCoins(pid, share);
  }

  return { success: true, stolen, share };
}
