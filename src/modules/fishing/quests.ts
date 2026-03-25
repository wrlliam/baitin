import { db } from "@/db";
import { fishingProfile, playerQuest } from "@/db/schema";
import type { PlayerQuestSelect } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { createId } from "@/utils/misc";
import {
  dailyQuests,
  weeklyQuests,
  QUESTS_PER_TYPE,
  type QuestType,
  type QuestAction,
  type QuestDef,
} from "@/data/quests";
import { getOrCreateProfile } from "./economy";
import { getRepPerks } from "./reputation";

const RARITY_RANK: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

function randomInRange([min, max]: [number, number]): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get or assign quests of a given type for a user.
 * If existing quests are expired, rolls new ones.
 */
export async function getOrAssignQuests(
  userId: string,
  type: QuestType,
): Promise<PlayerQuestSelect[]> {
  const now = new Date();

  // Fetch active quests
  const existing = await db
    .select()
    .from(playerQuest)
    .where(
      and(
        eq(playerQuest.userId, userId),
        eq(playerQuest.type, type),
        gt(playerQuest.expiresAt, now),
      ),
    );

  // Rep perk: +1 daily quest slot at 25+ rep
  const profile = await getOrCreateProfile(userId);
  const repPerks = getRepPerks(profile.reputation);
  const maxSlots = type === "daily" && repPerks.extraQuestSlot
    ? QUESTS_PER_TYPE + 1
    : QUESTS_PER_TYPE;

  if (existing.length >= maxSlots) return existing;

  // Clean up any expired quests of this type
  await db
    .delete(playerQuest)
    .where(
      and(
        eq(playerQuest.userId, userId),
        eq(playerQuest.type, type),
      ),
    );

  // Roll new quests
  const pool = type === "daily" ? dailyQuests : weeklyQuests;
  const selected = pickRandom(pool, maxSlots);
  const expiresAt = new Date();

  if (type === "daily") {
    expiresAt.setUTCHours(expiresAt.getUTCHours() + 24);
  } else {
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
  }

  const rows = selected.map((quest) => ({
    id: createId(),
    userId,
    questId: quest.id,
    type,
    progress: 0,
    goal: randomInRange(quest.goalRange),
    completed: false,
    claimed: false,
    assignedAt: now,
    expiresAt,
  }));

  await db.insert(playerQuest).values(rows);

  return db
    .select()
    .from(playerQuest)
    .where(
      and(
        eq(playerQuest.userId, userId),
        eq(playerQuest.type, type),
        gt(playerQuest.expiresAt, now),
      ),
    );
}

/**
 * Increment progress on matching active quests.
 * Called from action sites (cast, work, sell, etc).
 */
export async function incrementQuestProgress(
  userId: string,
  action: QuestAction,
  filter?: string,
  amount = 1,
): Promise<void> {
  const now = new Date();

  // Find all active uncompleted quests matching this action
  const quests = await db
    .select()
    .from(playerQuest)
    .where(
      and(
        eq(playerQuest.userId, userId),
        eq(playerQuest.completed, false),
        gt(playerQuest.expiresAt, now),
      ),
    );

  const allDefs = [...dailyQuests, ...weeklyQuests];
  const defMap = new Map(allDefs.map((d) => [d.id, d]));

  for (const quest of quests) {
    const def = defMap.get(quest.questId);
    if (!def || def.action !== action) continue;

    // For catch_rarity, check if the caught rarity is >= the required rarity
    if (action === "catch_rarity" && def.actionFilter && filter) {
      const requiredRank = RARITY_RANK[def.actionFilter] ?? 0;
      const caughtRank = RARITY_RANK[filter] ?? 0;
      if (caughtRank < requiredRank) continue;
    }

    const newProgress = Math.min(quest.progress + amount, quest.goal);
    const completed = newProgress >= quest.goal;

    await db
      .update(playerQuest)
      .set({ progress: newProgress, completed })
      .where(eq(playerQuest.id, quest.id));
  }
}

/**
 * Claim the reward for a completed quest.
 */
export async function claimQuestReward(
  userId: string,
  questRowId: string,
): Promise<{ success: boolean; coins: number; xp: number; gems: number; error?: string }> {
  const [quest] = await db
    .select()
    .from(playerQuest)
    .where(
      and(
        eq(playerQuest.id, questRowId),
        eq(playerQuest.userId, userId),
      ),
    );

  if (!quest) return { success: false, coins: 0, xp: 0, gems: 0, error: "Quest not found." };
  if (!quest.completed) return { success: false, coins: 0, xp: 0, gems: 0, error: "Quest not completed yet." };
  if (quest.claimed) return { success: false, coins: 0, xp: 0, gems: 0, error: "Already claimed." };

  const allDefs = [...dailyQuests, ...weeklyQuests];
  const def = allDefs.find((d) => d.id === quest.questId);
  if (!def) return { success: false, coins: 0, xp: 0, gems: 0, error: "Quest definition not found." };

  const coins = def.rewards.coins ? randomInRange(def.rewards.coins) : 0;
  const xp = def.rewards.xp ? randomInRange(def.rewards.xp) : 0;
  const gems = def.rewards.gems ? randomInRange(def.rewards.gems) : 0;

  // Mark as claimed
  await db
    .update(playerQuest)
    .set({ claimed: true })
    .where(eq(playerQuest.id, questRowId));

  // Award rewards
  if (coins > 0) {
    const { addCoins } = await import("./economy");
    await addCoins(userId, coins);
  }
  if (xp > 0) {
    const { addXp } = await import("./economy");
    await addXp(userId, xp);
  }
  if (gems > 0) {
    await addGems(userId, gems);
  }

  return { success: true, coins, xp, gems };
}

/** Add gems to a user's profile. */
export async function addGems(userId: string, amount: number): Promise<void> {
  await db
    .update(fishingProfile)
    .set({ gems: sql`${fishingProfile.gems} + ${amount}` })
    .where(eq(fishingProfile.userId, userId));
}

/** Subtract gems from a user's profile. Returns false if insufficient. */
export async function subtractGems(userId: string, amount: number): Promise<boolean> {
  const result = await db
    .update(fishingProfile)
    .set({ gems: sql`${fishingProfile.gems} - ${amount}` })
    .where(and(eq(fishingProfile.userId, userId), sql`${fishingProfile.gems} >= ${amount}`))
    .returning({ gems: fishingProfile.gems });

  return result.length > 0;
}

/** Get quest def by ID. */
export function getQuestDef(questId: string): QuestDef | undefined {
  const allDefs = [...dailyQuests, ...weeklyQuests];
  return allDefs.find((d) => d.id === questId);
}
