import { redis } from "@/db/redis";
import { db } from "@/db";
import { fishingInventory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateProfile, addCoins, subtractCoins } from "./economy";
import { removeItem, addItem } from "./inventory";
import { allItems } from "@/data";
import { checkStealAchievements } from "./achievements";
import type { AchievementDef } from "@/data/achievements";

export type StealResult =
  | { success: true; type: "item"; itemId: string; itemName: string; itemEmoji: string; newAchievements?: AchievementDef[] }
  | { success: true; type: "coins"; amount: number; newAchievements?: AchievementDef[] }
  | { success: false; error: "cooldown"; expiresAt: number }
  | { success: false; error: "target_immune"; expiresAt: number }
  | { success: false; error: "level_diff" }
  | { success: false; error: "caught"; fine: number }
  | { success: false; error: "target_empty" };

const STEAL_CD_TTL = 3600;  // 1 hour
const IMMUNE_TTL = 1800;    // 30 minutes

export async function canSteal(userId: string): Promise<{ ok: boolean; expiresAt?: number }> {
  const val = await redis.get(`steal:cd:${userId}`);
  if (!val) return { ok: true };
  return { ok: false, expiresAt: parseInt(val) };
}

export async function isImmune(userId: string): Promise<{ immune: boolean; expiresAt?: number }> {
  const val = await redis.get(`steal:immune:${userId}`);
  if (!val) return { immune: false };
  return { immune: true, expiresAt: parseInt(val) };
}

export async function attemptSteal(thiefId: string, targetId: string): Promise<StealResult> {
  // Check thief cooldown
  const cd = await canSteal(thiefId);
  if (!cd.ok) return { success: false, error: "cooldown", expiresAt: cd.expiresAt! };

  // Check target immunity
  const immunity = await isImmune(targetId);
  if (immunity.immune) return { success: false, error: "target_immune", expiresAt: immunity.expiresAt! };

  const [thiefProfile, targetProfile] = await Promise.all([
    getOrCreateProfile(thiefId),
    getOrCreateProfile(targetId),
  ]);

  // Level difference check — can't steal from someone more than 5 levels below
  if (targetProfile.level < thiefProfile.level - 5) {
    return { success: false, error: "level_diff" };
  }

  // Success chance: clamp 10-90%, +5% per level thief is above target
  const levelDiff = thiefProfile.level - targetProfile.level;
  const successChance = Math.max(0.1, Math.min(0.9, 0.5 + levelDiff * 0.05));
  const success = Math.random() < successChance;

  const immuneExpiresAt = Date.now() + IMMUNE_TTL * 1000;
  const cdExpiresAt = Date.now() + STEAL_CD_TTL * 1000;

  if (!success) {
    const fine = 200;
    await subtractCoins(thiefId, fine);
    await redis.set(`steal:cd:${thiefId}`, cdExpiresAt.toString());
    await redis.send("EXPIRE", [`steal:cd:${thiefId}`, STEAL_CD_TTL.toString()]);
    return { success: false, error: "caught", fine };
  }

  // Get target's sellable inventory (fish/junk)
  const targetInv = await db
    .select()
    .from(fishingInventory)
    .where(eq(fishingInventory.userId, targetId));

  const sellableInv = targetInv.filter((i) => i.itemType === "fish" || i.itemType === "junk");
  const stealItem = sellableInv.length > 0 && Math.random() < 0.6;

  let result: StealResult;

  if (stealItem) {
    const pick = sellableInv[Math.floor(Math.random() * sellableInv.length)];
    const removed = await removeItem(targetId, pick.itemId, 1);
    if (!removed) {
      result = await _stealCoins(thiefId, targetId, targetProfile.coins);
    } else {
      await addItem(thiefId, pick.itemId, pick.itemType, 1);
      const itemData = allItems.get(pick.itemId);
      result = {
        success: true,
        type: "item",
        itemId: pick.itemId,
        itemName: itemData?.name ?? pick.itemId,
        itemEmoji: itemData?.emoji ?? "📦",
      };
    }
  } else {
    result = await _stealCoins(thiefId, targetId, targetProfile.coins);
  }

  // Set target immune + thief cooldown
  await redis.set(`steal:immune:${targetId}`, immuneExpiresAt.toString());
  await redis.send("EXPIRE", [`steal:immune:${targetId}`, IMMUNE_TTL.toString()]);
  await redis.set(`steal:cd:${thiefId}`, cdExpiresAt.toString());
  await redis.send("EXPIRE", [`steal:cd:${thiefId}`, STEAL_CD_TTL.toString()]);

  // Track steal count for achievements
  const stealCountKey = `steal:total:${thiefId}`;
  const currentCount = parseInt((await redis.get(stealCountKey)) ?? "0") + 1;
  await redis.set(stealCountKey, currentCount.toString());
  const newAchievements = await checkStealAchievements(thiefId, currentCount);

  if (result.success) {
    return { ...result, newAchievements };
  }

  return result;
}

async function _stealCoins(thiefId: string, targetId: string, targetCoins: number): Promise<StealResult> {
  if (targetCoins < 50) {
    return { success: false, error: "target_empty" };
  }
  const pct = 0.05 + Math.random() * 0.05; // 5-10%
  const amount = Math.max(50, Math.min(2000, Math.floor(targetCoins * pct)));
  await subtractCoins(targetId, amount);
  await addCoins(thiefId, amount);
  return { success: true, type: "coins", amount };
}
