import { redis } from "@/db/redis";
import { fish as fishData } from "@/data/fish";
import { junk as junkData } from "@/data/junk";
import { baitItems, rodItems } from "@/data";
import { getOrCreateProfile } from "./economy";
import { addCoins, addXp } from "./economy";
import { addItem } from "./inventory";
import { removeItem, getItemQuantity } from "./inventory";
import { getActiveEvent } from "./events";
import { getPetBuffs } from "./pets";
import type { CatchResult, Fish, JunkItem } from "@/data/types";

const COOLDOWN_SECONDS = 15;

export async function canFish(userId: string): Promise<{ ok: boolean; remaining: number }> {
  const key = `fish:cd:${userId}`;
  const lastFish = await redis.get(key);

  if (lastFish) {
    const elapsed = Date.now() - parseInt(lastFish);
    const remaining = Math.max(0, COOLDOWN_SECONDS * 1000 - elapsed);
    if (remaining > 0) return { ok: false, remaining };
  }

  return { ok: true, remaining: 0 };
}

export async function doFish(userId: string): Promise<CatchResult> {
  const profile = await getOrCreateProfile(userId);
  const rod = rodItems.get(profile.equippedRodId ?? "splintered_twig");
  const bait = profile.equippedBaitId ? baitItems.get(profile.equippedBaitId) : null;
  const petBuffs = await getPetBuffs(userId);
  const event = await getActiveEvent();

  // Build junk chance: base 20%, reduced by rod luck and bait
  let junkChance = 0.2;
  if (rod) junkChance -= rod.luckBonus * 0.5;
  if (bait) junkChance += bait.junkModifier; // junkModifier is negative
  if (petBuffs.luck_boost) junkChance -= petBuffs.luck_boost * 0.3;
  junkChance = Math.max(0.02, Math.min(0.5, junkChance));

  // Event effects
  let rarityMult = 1;
  let xpMult = 1;
  let coinMult = 1;

  if (event) {
    for (const effect of event.effects) {
      if (effect.type === "rarity_boost") rarityMult *= effect.value;
      if (effect.type === "xp_multiplier") xpMult *= effect.value;
      if (effect.type === "coin_multiplier") coinMult *= effect.value;
      if (effect.type === "catch_rate") junkChance /= effect.value;
    }
  }

  // Bait rarity multiplier
  if (bait) rarityMult *= bait.rarityMultiplier;
  if (rod) rarityMult += rod.luckBonus;

  // Decide fish or junk
  const isJunk = Math.random() < junkChance;

  let item: Fish | JunkItem;

  if (isJunk) {
    item = weightedRandom(junkData);
  } else {
    item = weightedRandomWithRarity(fishData, rarityMult);
  }

  // Consume bait
  let baitConsumed = false;
  if (bait && bait.consumedOnUse) {
    const qty = await getItemQuantity(userId, bait.id);
    if (qty > 0) {
      await removeItem(userId, bait.id, 1);
      baitConsumed = true;
      // If last bait, unequip
      if (qty <= 1) {
        const { fishingProfile } = await import("@/db/schema");
        const { db } = await import("@/db");
        const { eq } = await import("drizzle-orm");
        await db
          .update(fishingProfile)
          .set({ equippedBaitId: null })
          .where(eq(fishingProfile.userId, userId));
      }
    }
  }

  // Add to inventory
  await addItem(userId, item.id, item.category, 1);

  // XP and coins
  const baseCoins = Math.max(1, Math.floor(item.price * 0.1));
  const baseXp = isJunk ? 1 : (item as Fish).xp;

  const coinsGained = Math.floor(baseCoins * coinMult * (1 + (petBuffs.coin_boost ?? 0)));
  const xpGained = Math.floor(baseXp * xpMult * (1 + (petBuffs.xp_boost ?? 0)));

  await addCoins(userId, coinsGained);
  const { levelUp, newLevel } = await addXp(userId, xpGained);

  // Hut drop chance (~0.1%)
  const hutDrop = Math.random() < 0.001;

  // Set cooldown
  let cdSeconds = COOLDOWN_SECONDS;
  if (petBuffs.cooldown_reduction) {
    cdSeconds = Math.max(5, Math.floor(cdSeconds * (1 - petBuffs.cooldown_reduction)));
  }
  await redis.set(`fish:cd:${userId}`, Date.now().toString());
  await redis.send("EXPIRE", [`fish:cd:${userId}`, cdSeconds.toString()]);

  // Log catch
  const { fishingLog } = await import("@/db/schema");
  const { db } = await import("@/db");
  const { createId } = await import("@/utils/misc");
  await db.insert(fishingLog).values({
    id: createId(),
    userId,
    itemId: item.id,
    itemType: item.category,
  });

  return { item, xpGained, coinsGained, baitConsumed, hutDrop, levelUp, newLevel };
}

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }

  return items[items.length - 1];
}

function weightedRandomWithRarity<T extends { weight: number }>(items: T[], rarityMult: number): T {
  // Higher rarity mult increases weight of rare items (lower base weight)
  const adjustedItems = items.map((item) => {
    const inverseWeight = 1 / Math.max(1, item.weight);
    const boostedWeight = item.weight + inverseWeight * rarityMult * 500;
    return { ...item, weight: boostedWeight };
  });

  return weightedRandom(adjustedItems);
}
