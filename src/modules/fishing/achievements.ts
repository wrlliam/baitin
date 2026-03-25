import { db } from "@/db";
import { achievement, fishingProfile, fishingLog } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { achievementMap, type AchievementDef, type ProgressType } from "@/data/achievements";
import { fish as fishData } from "@/data/fish";
import { addCoins, addXp, getOrCreateProfile } from "./economy";
import { createId } from "@/utils/misc";

export async function getUnlockedAchievements(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(achievement)
    .where(eq(achievement.userId, userId));
  return rows.map((r) => r.achievementId);
}

export async function hasAchievement(userId: string, achievementId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(achievement)
    .where(and(eq(achievement.userId, userId), eq(achievement.achievementId, achievementId)));
  return rows.length > 0;
}

/**
 * Unlock an achievement for a user if not already unlocked.
 * Returns the achievement def if newly unlocked, null if already had it.
 */
export async function unlockAchievement(
  userId: string,
  achievementId: string,
): Promise<AchievementDef | null> {
  const def = achievementMap.get(achievementId);
  if (!def) return null;

  const already = await hasAchievement(userId, achievementId);
  if (already) return null;

  await db.insert(achievement).values({
    id: createId(),
    userId,
    achievementId,
  });

  if (def.coinReward > 0) await addCoins(userId, def.coinReward);
  if (def.xpReward > 0) await addXp(userId, def.xpReward);

  return def;
}

/**
 * Check and unlock achievements based on the current fishing profile state.
 * Call this after a catch or relevant action.
 * Returns list of newly unlocked achievement defs.
 */
export async function checkCatchAchievements(
  userId: string,
  opts: {
    totalCatches: number;
    itemRarity?: string;
    itemType?: string;
    junkTotal?: number;
    currentStreak?: number;
    rodBroke?: boolean;
  },
): Promise<AchievementDef[]> {
  const unlocked: AchievementDef[] = [];

  const tryUnlock = async (id: string) => {
    const result = await unlockAchievement(userId, id);
    if (result) unlocked.push(result);
  };

  const { totalCatches, itemRarity, itemType, junkTotal, currentStreak, rodBroke } = opts;

  // Catch milestones
  if (totalCatches >= 1) await tryUnlock("first_catch");
  if (totalCatches >= 10) await tryUnlock("catches_10");
  if (totalCatches >= 100) await tryUnlock("catches_100");
  if (totalCatches >= 500) await tryUnlock("catches_500");
  if (totalCatches >= 1000) await tryUnlock("catches_1000");

  // Rarity milestones (only for fish)
  if (itemType === "fish" && itemRarity) {
    if (itemRarity === "rare" || itemRarity === "epic" || itemRarity === "legendary" || itemRarity === "mythic") {
      await tryUnlock("first_rare");
    }
    if (itemRarity === "epic" || itemRarity === "legendary" || itemRarity === "mythic") {
      await tryUnlock("first_epic");
    }
    if (itemRarity === "legendary" || itemRarity === "mythic") {
      await tryUnlock("first_legendary");
    }
    if (itemRarity === "mythic") {
      await tryUnlock("first_mythic");
    }
  }

  // Collection milestones (only check on fish catches to avoid unnecessary queries)
  if (itemType === "fish") {
    const [{ uniqueCount }] = await db
      .select({ uniqueCount: sql<number>`cast(count(distinct ${fishingLog.itemId}) as int)` })
      .from(fishingLog)
      .where(and(eq(fishingLog.userId, userId), eq(fishingLog.itemType, "fish")));

    const totalSpecies = fishData.length;
    const pct = uniqueCount / totalSpecies;
    if (pct >= 0.25) await tryUnlock("collector_25");
    if (pct >= 0.50) await tryUnlock("collector_50");
    if (pct >= 0.75) await tryUnlock("collector_75");
    if (pct >= 1.00) await tryUnlock("collector_100");
  }

  // Junk
  if (junkTotal !== undefined) {
    if (junkTotal >= 50) await tryUnlock("junk_collector");
    if (junkTotal >= 200) await tryUnlock("junk_hoarder");
  }

  // Streak
  if (currentStreak !== undefined) {
    if (currentStreak >= 3) await tryUnlock("streak_3");
    if (currentStreak >= 7) await tryUnlock("streak_7");
    if (currentStreak >= 30) await tryUnlock("streak_30");
  }

  // Rod broke
  if (rodBroke) await tryUnlock("rod_broke");

  return unlocked;
}

export async function checkEconomyAchievements(
  userId: string,
  opts: { coins?: number; madeMarketSale?: boolean; spentInShop?: number },
): Promise<AchievementDef[]> {
  const unlocked: AchievementDef[] = [];
  const tryUnlock = async (id: string) => {
    const result = await unlockAchievement(userId, id);
    if (result) unlocked.push(result);
  };

  const { coins, madeMarketSale, spentInShop } = opts;

  if (coins !== undefined) {
    if (coins >= 1000) await tryUnlock("earn_1000");
    if (coins >= 10000) await tryUnlock("earn_10000");
  }
  if (madeMarketSale) await tryUnlock("first_market_sale");
  if (spentInShop !== undefined && spentInShop >= 5000) await tryUnlock("big_spender");

  return unlocked;
}

export async function checkGearAchievements(
  userId: string,
  opts: { boughtRod?: boolean; boughtHut?: boolean; hatchedPet?: boolean },
): Promise<AchievementDef[]> {
  const unlocked: AchievementDef[] = [];
  const tryUnlock = async (id: string) => {
    const result = await unlockAchievement(userId, id);
    if (result) unlocked.push(result);
  };

  if (opts.boughtRod) await tryUnlock("first_rod_upgrade");
  if (opts.boughtHut) await tryUnlock("hut_owner");
  if (opts.hatchedPet) await tryUnlock("first_pet");

  return unlocked;
}

/**
 * Get current progress values for all progress-based achievement types.
 * Returns a map from ProgressType to the current count.
 */
export async function getAchievementProgress(
  userId: string,
): Promise<Record<ProgressType, number>> {
  const profile = await getOrCreateProfile(userId);

  const [junkResult, uniqueResult] = await Promise.all([
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(fishingLog)
      .where(and(eq(fishingLog.userId, userId), eq(fishingLog.itemType, "junk"))),
    db
      .select({ count: sql<number>`cast(count(distinct ${fishingLog.itemId}) as int)` })
      .from(fishingLog)
      .where(and(eq(fishingLog.userId, userId), eq(fishingLog.itemType, "fish"))),
  ]);

  const totalSpecies = fishData.length;
  const uniqueCount = uniqueResult[0]?.count ?? 0;
  const collectionPct = totalSpecies > 0 ? Math.floor((uniqueCount / totalSpecies) * 100) : 0;

  return {
    catches: profile.totalCatches,
    junk: junkResult[0]?.count ?? 0,
    streak: profile.currentStreak ?? 0,
    collection: collectionPct,
    coins: profile.coins,
    steals: 0, // steal count not tracked in profile; will show 0 for display
  };
}

export async function checkStealAchievements(
  userId: string,
  stealSuccessTotal: number,
): Promise<AchievementDef[]> {
  const unlocked: AchievementDef[] = [];
  const tryUnlock = async (id: string) => {
    const result = await unlockAchievement(userId, id);
    if (result) unlocked.push(result);
  };

  if (stealSuccessTotal >= 1) await tryUnlock("first_steal");
  if (stealSuccessTotal >= 10) await tryUnlock("steal_10");

  return unlocked;
}
