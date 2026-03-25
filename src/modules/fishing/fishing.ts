import { redis } from "@/db/redis";
import { db } from "@/db";
import { fishingProfile, fishingLog } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { fish as fishData } from "@/data/fish";
import { junk as junkData } from "@/data/junk";
import { baitItems, rodItems } from "@/data";
import { getOrCreateProfile } from "./economy";
import { addCoins, addXp } from "./economy";
import { addItem } from "./inventory";
import { removeItem, getItemQuantity } from "./inventory";
import { getActiveEvent } from "./events";
import { getPetBuffs } from "./pets";
import { applyBuffsToCalculation } from "./buffs";
import { checkCatchAchievements } from "./achievements";
import { getOrCreateUpgrades, incrementCastCount } from "./upgrades";
import { createId } from "@/utils/misc";
import config from "@/config";
import { getLevel } from "@/utils/leveling";
import { levelRewardMap } from "@/data/levels";
import { getRepPerks } from "./reputation";
import { getCurrentWeather } from "./weather";
import { addBattlepassXp } from "./battlepass";
import { locationMap } from "@/data/locations";
import { getCurrentSeason as getSeasonData } from "@/data/seasons";
import { getSeasonalFish } from "./seasons";
import type { CatchResult, Fish, JunkItem } from "@/data/types";

const COOLDOWN_SECONDS = 20;

/** Deterministic "Fish of the Day" — same fish for all players on a given UTC day */
export function getFishOfTheDay(): Fish {
  const daySeed = Math.floor(Date.now() / 86_400_000);
  return fishData[daySeed % fishData.length];
}

export async function canFish(
  userId: string,
): Promise<{ ok: boolean; remaining: number; expiresAt?: number }> {
  const key = `fish:cd:${userId}`;
  const lastFish = await redis.get(key);

  if (lastFish) {
    const setAt = parseInt(lastFish);
    const elapsed = Date.now() - setAt;
    const remaining = Math.max(0, COOLDOWN_SECONDS * 1000 - elapsed);
    if (remaining > 0) {
      const expiresAt = Math.floor((setAt + COOLDOWN_SECONDS * 1000) / 1000);
      return { ok: false, remaining, expiresAt };
    }
  }

  return { ok: true, remaining: 0 };
}

export async function doFish(userId: string): Promise<CatchResult> {
  // ── Fetch profile ONCE, pass it everywhere ──
  const profile = await getOrCreateProfile(userId);
  const rod = rodItems.get(profile.equippedRodId ?? "splintered_twig");
  const bait = profile.equippedBaitId
    ? baitItems.get(profile.equippedBaitId)
    : null;

  // ── Parallelize independent async calls: petBuffs + event + upgrades ──
  const [petBuffs, event, upgData] = await Promise.all([
    getPetBuffs(userId, profile),
    getActiveEvent(),
    getOrCreateUpgrades(userId),
  ]);

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
  let eventCdMult = 1;

  if (event) {
    // Check entry fee enforcement: only apply event bonuses if no fee or user has joined
    let eventApplies = true;
    if (event.entryFee && event.entryFee > 0) {
      const joinedKey = `event:joined:${event.id}:${userId}`;
      const hasJoined = await redis.get(joinedKey);
      if (!hasJoined) eventApplies = false;
    }

    if (eventApplies) {
      for (const effect of event.effects) {
        if (effect.type === "rarity_boost") rarityMult *= effect.value;
        if (effect.type === "xp_multiplier") xpMult *= effect.value;
        if (effect.type === "coin_multiplier") coinMult *= effect.value;
        if (effect.type === "catch_rate") junkChance /= effect.value;
        if (effect.type === "junk_reduction") junkChance *= effect.value;
        if (effect.type === "cooldown_reduction") eventCdMult *= effect.value;
      }
    }
  }

  // Weather effects (deterministic from UTC time, no Redis)
  const weather = getCurrentWeather();
  for (const effect of weather.effects) {
    if (effect.type === "rarity_boost") rarityMult *= effect.value;
    if (effect.type === "xp_multiplier") xpMult *= effect.value;
    if (effect.type === "coin_multiplier") coinMult *= effect.value;
    if (effect.type === "catch_rate") junkChance /= effect.value;
  }

  // Location effects
  const location = locationMap.get(profile.equippedLocation ?? "pond");
  if (location) {
    for (const effect of location.effects) {
      if (effect.type === "rarity_boost") rarityMult *= effect.value;
      if (effect.type === "xp_multiplier") xpMult *= effect.value;
      if (effect.type === "coin_multiplier") coinMult *= effect.value;
      if (effect.type === "catch_rate") junkChance /= effect.value;
    }
  }

  // Seasonal effects
  const season = getSeasonData();
  for (const effect of season.effects) {
    if (effect.type === "rarity_boost") rarityMult *= effect.value;
    if (effect.type === "xp_multiplier") xpMult *= effect.value;
    if (effect.type === "coin_multiplier") coinMult *= effect.value;
    if (effect.type === "catch_rate") junkChance /= effect.value;
  }

  // Chum Streamer: every 10th cast gets a luck bonus
  let chumProc = false;
  if (upgData.chumStreamer) {
    const castCount = await incrementCastCount(userId);
    if (castCount % 10 === 0) {
      rarityMult *= 1.5;
      junkChance *= 0.5;
      chumProc = true;
    }
  }

  // High-Tension Line: +10% luck bonus on legendary+ fish
  if (upgData.highTensionLine) {
    rarityMult *= 1.1;
  }

  // Bait rarity multiplier
  if (bait) rarityMult *= bait.rarityMultiplier;
  if (rod) rarityMult += rod.luckBonus;

  // Cooldown base seconds (pets + events reduce it)
  let cdSeconds = COOLDOWN_SECONDS;
  if (petBuffs.cooldown_reduction) {
    cdSeconds = Math.max(
      5,
      Math.floor(cdSeconds * (1 - petBuffs.cooldown_reduction)),
    );
  }
  if (eventCdMult !== 1) {
    cdSeconds = Math.max(5, Math.floor(cdSeconds * eventCdMult));
  }

  // Apply active buffs (potions)
  const afterBuffs = await applyBuffsToCalculation(userId, {
    xpMult,
    coinMult,
    rarityMult,
    cooldownSecs: cdSeconds,
  });
  xpMult = afterBuffs.xpMult;
  coinMult = afterBuffs.coinMult;
  rarityMult = afterBuffs.rarityMult;
  cdSeconds = afterBuffs.cooldownSecs;

  // Decide fish or junk
  const isJunk = Math.random() < junkChance;

  let item: Fish | JunkItem;

  if (isJunk) {
    item = weightedRandom(junkData);
  } else {
    // Inject location-exclusive fish + seasonal fish into the pool
    const extras: Fish[] = [];
    if (location && location.exclusiveFish.length > 0) extras.push(...location.exclusiveFish);
    const seasonal = getSeasonalFish();
    if (seasonal.length > 0) extras.push(...seasonal);
    const fishPool = extras.length > 0 ? [...fishData, ...extras] : fishData;
    item = weightedRandomWithRarity(fishPool, rarityMult);
  }

  // Consume bait (Bait Compressor: 15% chance to skip consumption)
  let baitConsumed = false;
  let baitRemaining: number | null = null;
  let baitRanOut = false;
  if (bait && bait.consumedOnUse) {
    const skipConsume = upgData.baitCompressor && Math.random() < 0.15;
    const qty = await getItemQuantity(userId, bait.id);
    if (qty > 0 && !skipConsume) {
      await removeItem(userId, bait.id, 1);
      baitConsumed = true;
      baitRemaining = qty - 1;
      // If last bait, unequip but keep preferredBaitId for re-equip later
      if (qty <= 1) {
        baitRanOut = true;
        await db
          .update(fishingProfile)
          .set({ equippedBaitId: null })
          .where(eq(fishingProfile.userId, userId));
      }
    } else if (qty > 0 && skipConsume) {
      // Bait compressor saved the bait
      baitRemaining = qty;
    }
  }

  // Rod durability
  let rodBroke = false;
  if (rod && rod.durability > 0) {
    const currentDurability = profile.equippedRodDurability ?? rod.durability;
    const newDurability = currentDurability - 1;
    if (newDurability <= 0) {
      // Rod breaks — revert to splintered twig
      await db
        .update(fishingProfile)
        .set({ equippedRodId: "splintered_twig", equippedRodDurability: null })
        .where(eq(fishingProfile.userId, userId));
      rodBroke = true;
    } else {
      await db
        .update(fishingProfile)
        .set({ equippedRodDurability: newDurability })
        .where(eq(fishingProfile.userId, userId));
    }
  }

  // Add to inventory — pass sackLevel + tackleBoxLevel to avoid re-fetching
  await addItem(userId, item.id, item.category, 1, profile.sackLevel, upgData.tackleBoxLevel);

  // Auto-Sell: immediately sell low-value catches
  let autoSold = false;
  let autoSoldCoins = 0;
  if (upgData.autoSellEnabled && item.price <= upgData.autoSellMinValue) {
    // Deep-Sea Sonar: skip auto-sell if rarity is whitelisted
    const sonarRarities = (upgData.deepSeaSonarRarities as string[]) ?? [];
    if (!sonarRarities.includes(item.rarity)) {
      await removeItem(userId, item.id, 1);
      autoSoldCoins = item.price;
      autoSold = true;
    }
  }

  // Fish of the Day: 2× base coin value
  const isFotd = !isJunk && item.id === getFishOfTheDay().id;
  const fotdMult = isFotd ? 2 : 1;

  // XP and coins
  const baseCoins = Math.max(1, Math.floor(item.price * 0.1)) * fotdMult;
  const baseXp = isJunk ? 1 : (item as Fish).xp;

  // Level coin bonus: +1.5% per level above 1
  const levelCoinBonus =
    1 + (profile.level - 1) * config.fishing.levelCoinBonusPercent;

  // Streak logic
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const lastFishDate = profile.lastFishDate;
  let currentStreak = profile.currentStreak ?? 0;
  let streakBonus = false;

  // Build a batch of profile field updates to combine into one DB call
  const profileUpdates: Record<string, unknown> = {};

  if (!lastFishDate || lastFishDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastFishDate === yesterdayStr) {
      currentStreak += 1;
    } else if (lastFishDate !== today) {
      currentStreak = 1;
    }
    streakBonus = currentStreak > 1;

    profileUpdates.currentStreak = currentStreak;
    profileUpdates.lastFishDate = today;
  }

  // Streak XP/coin bonus: +5% per streak day above 1, capped at 10 levels (50%)
  if (streakBonus) {
    const bonusMult = Math.min(currentStreak - 1, 10) * 0.05;
    coinMult *= 1 + bonusMult;
    xpMult *= 1 + bonusMult;
  }

  // Prestige bonus: +5% XP, +3% coins per prestige level
  const prestigeXpMult = 1 + (profile.prestigeLevel ?? 0) * 0.05;
  const prestigeCoinMult = 1 + (profile.prestigeLevel ?? 0) * 0.03;

  const finalCoins = Math.floor(
    baseCoins * coinMult * (1 + (petBuffs.coin_boost ?? 0)) * levelCoinBonus * prestigeCoinMult,
  );
  // Rep perk: +5% XP at 100+ rep
  const repPerks = getRepPerks(profile.reputation);
  const finalXp = Math.floor(baseXp * xpMult * (1 + (petBuffs.xp_boost ?? 0)) * (1 + repPerks.xpBonus) * prestigeXpMult);

  // ── Batch the final writes: combine addXp fields + streak + totalCatches into one UPDATE ──
  const newXp = profile.xp + finalXp;
  const newLevel = getLevel(newXp);
  const levelUp = newLevel > profile.level;

  profileUpdates.xp = newXp;
  profileUpdates.level = newLevel;
  profileUpdates.totalCatches = sql`${fishingProfile.totalCatches} + 1`;

  // Level milestone rewards
  let milestoneCoins = 0;
  if (levelUp) {
    for (let lvl = profile.level + 1; lvl <= newLevel; lvl++) {
      const reward = levelRewardMap.get(lvl);
      if (reward) {
        milestoneCoins += reward.coins;
        if (reward.gems > 0) {
          profileUpdates.gems = sql`${fishingProfile.gems} + ${reward.gems}`;
        }
      }
    }
  }

  // Apply the batched profile update (streak + xp + level + totalCatches + gems in one query)
  await db
    .update(fishingProfile)
    .set(profileUpdates)
    .where(eq(fishingProfile.userId, userId));

  // addCoins still needs its own UPDATE because of the RETURNING + achievement check
  await addCoins(userId, finalCoins + autoSoldCoins + milestoneCoins);

  // Battle pass XP (fire-and-forget)
  void addBattlepassXp(userId, finalXp);

  // Hut drop chance (~0.1%)
  const hutDrop = Math.random() < 0.001;

  // ── Pipeline Redis cooldown SET + EXPIRE using SETEX ──
  await redis.send("SETEX", [
    `fish:cd:${userId}`,
    cdSeconds.toString(),
    Date.now().toString(),
  ]);

  // ── Log catch + count junk in parallel ──
  const logId = createId();
  const [, junkCountResult] = await Promise.all([
    db.insert(fishingLog).values({
      id: logId,
      userId,
      itemId: item.id,
      itemType: item.category,
    }),
    db
      .select({ junkCount: sql<number>`cast(count(*) as int)` })
      .from(fishingLog)
      .where(
        and(eq(fishingLog.userId, userId), eq(fishingLog.itemType, "junk")),
      ),
  ]);

  // The junk count query runs against the state before our insert commits,
  // so adjust if the current catch is junk
  const junkTotal = (junkCountResult[0]?.junkCount ?? 0) + (isJunk ? 1 : 0);

  const newAchievements = await checkCatchAchievements(userId, {
    totalCatches: profile.totalCatches + 1,
    itemRarity: item.rarity,
    itemType: item.category,
    junkTotal,
    currentStreak,
    rodBroke,
  });

  return {
    item,
    xpGained: finalXp,
    coinsGained: finalCoins,
    baitConsumed,
    hutDrop,
    levelUp,
    newLevel,
    rodBroke,
    rodName: rod?.name ?? "Splintered Twig",
    streakDay: currentStreak,
    streakBonus,
    newAchievements,
    baitRemaining,
    baitRanOut,
    autoSold,
    autoSoldCoins,
    fotd: isFotd,
  };
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

function weightedRandomWithRarity<T extends { weight: number }>(
  items: T[],
  rarityMult: number,
): T {
  // Higher rarity mult increases weight of rare items (lower base weight)
  const adjustedItems = items.map((item) => {
    const inverseWeight = 1 / Math.max(1, item.weight);
    const boostedWeight = item.weight + inverseWeight * rarityMult * 500;
    return { ...item, weight: boostedWeight };
  });

  return weightedRandom(adjustedItems);
}
