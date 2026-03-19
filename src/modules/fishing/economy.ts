import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import type { FishingProfileSelect } from "@/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { createId } from "@/utils/misc";

export async function getOrCreateProfile(userId: string) {
  const existing = await db
    .select()
    .from(fishingProfile)
    .where(eq(fishingProfile.userId, userId));

  if (existing[0]) return existing[0];

  const id = createId();
  await db
    .insert(fishingProfile)
    .values({ id, userId })
    .onConflictDoNothing({ target: fishingProfile.userId });

  const created = await db
    .select()
    .from(fishingProfile)
    .where(eq(fishingProfile.userId, userId));

  return created[0]!;
}

/** Returns existing profile if provided, otherwise fetches/creates one. */
export async function getOrCreateProfileCached(userId: string, existing?: FishingProfileSelect) {
  if (existing) return existing;
  return getOrCreateProfile(userId);
}

export async function addCoins(userId: string, amount: number) {
  // Caller is responsible for ensuring the profile exists.
  // Use UPDATE with RETURNING to avoid a separate SELECT for achievement checks.
  const [updated] = await db
    .update(fishingProfile)
    .set({ coins: sql`${fishingProfile.coins} + ${amount}` })
    .where(eq(fishingProfile.userId, userId))
    .returning({ coins: fishingProfile.coins });

  // Check coin milestones (lazy import to avoid circular deps)
  if (amount > 0 && updated) {
    const { checkEconomyAchievements } = await import("./achievements");
    await checkEconomyAchievements(userId, { coins: updated.coins });

    // Quest progress (fire-and-forget)
    const { incrementQuestProgress } = await import("./quests");
    void incrementQuestProgress(userId, "earn_coins", undefined, amount);
  }
}

export async function subtractCoins(userId: string, amount: number): Promise<boolean> {
  const result = await db
    .update(fishingProfile)
    .set({ coins: sql`${fishingProfile.coins} - ${amount}` })
    .where(and(eq(fishingProfile.userId, userId), gte(fishingProfile.coins, amount)))
    .returning({ coins: fishingProfile.coins });

  return result.length > 0;
}

export async function getBalance(userId: string): Promise<number> {
  const profile = await getOrCreateProfile(userId);
  return profile.coins;
}

/**
 * Add XP to a user's profile. Only increments totalCatches when
 * incrementCatch is true (i.e. the fishing hot path).
 * When called from other contexts (achievements, dev commands, rewards)
 * totalCatches is left unchanged.
 */
export async function addXp(
  userId: string,
  amount: number,
  currentXp?: number,
  currentLevel?: number,
  incrementCatch = false,
): Promise<{ levelUp: boolean; newLevel: number }> {
  let xp: number;
  let level: number;

  if (currentXp !== undefined && currentLevel !== undefined) {
    xp = currentXp;
    level = currentLevel;
  } else {
    const profile = await getOrCreateProfile(userId);
    xp = profile.xp;
    level = profile.level;
  }

  const newXp = xp + amount;
  const xpPerLevel = 100;
  const newLevel = Math.floor(newXp / xpPerLevel) + 1;
  const levelUp = newLevel > level;

  const updates: Record<string, unknown> = {
    xp: newXp,
    level: newLevel,
  };

  if (incrementCatch) {
    updates.totalCatches = sql`${fishingProfile.totalCatches} + 1`;
  }

  await db
    .update(fishingProfile)
    .set(updates)
    .where(eq(fishingProfile.userId, userId));

  return { levelUp, newLevel };
}
