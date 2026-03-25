import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateProfile, addCoins, addGems } from "./economy";
import { addItem } from "./inventory";
import { unlockAchievement } from "./achievements";
import { battlePassTiers, battlePassTierMap, type BattlePassReward } from "@/data/battlepass";

/** Deterministic season number from current UTC month */
export function getCurrentSeason(): number {
  const now = new Date();
  return now.getUTCFullYear() * 12 + now.getUTCMonth();
}

/** Reset battle pass if the season has changed. Returns true if reset occurred. */
export async function resetIfNewSeason(userId: string): Promise<boolean> {
  const profile = await getOrCreateProfile(userId);
  const currentSeason = getCurrentSeason();

  if (profile.battlepassSeason !== currentSeason) {
    await db
      .update(fishingProfile)
      .set({
        battlepassTier: 0,
        battlepassXp: 0,
        battlepassPremium: false,
        battlepassSeason: currentSeason,
        battlepassClaimed: [],
      })
      .where(eq(fishingProfile.userId, userId));
    return true;
  }
  return false;
}

/** Add XP to the battle pass tier progression. Returns new tier if levelled up. */
export async function addBattlepassXp(
  userId: string,
  xp: number,
): Promise<{ newTier: number; tieredUp: boolean }> {
  await resetIfNewSeason(userId);
  const profile = await getOrCreateProfile(userId);

  let currentXp = profile.battlepassXp + xp;
  let currentTier = profile.battlepassTier;
  let tieredUp = false;

  // Check if we can advance tiers
  while (currentTier < 30) {
    const nextTier = battlePassTiers[currentTier]; // index = tier-1 for next tier
    if (!nextTier) break;
    if (currentXp >= nextTier.xpRequired) {
      currentXp -= nextTier.xpRequired;
      currentTier++;
      tieredUp = true;
    } else {
      break;
    }
  }

  await db
    .update(fishingProfile)
    .set({
      battlepassTier: currentTier,
      battlepassXp: currentXp,
    })
    .where(eq(fishingProfile.userId, userId));

  return { newTier: currentTier, tieredUp };
}

/** Claim a battle pass tier reward. Returns the reward or null if not claimable. */
export async function claimTier(
  userId: string,
  tier: number,
): Promise<{ free: BattlePassReward; premium: BattlePassReward | null } | null> {
  await resetIfNewSeason(userId);
  const profile = await getOrCreateProfile(userId);

  if (tier > profile.battlepassTier || tier < 1 || tier > 30) return null;

  const claimed = (profile.battlepassClaimed as number[]) ?? [];
  if (claimed.includes(tier)) return null;

  const tierDef = battlePassTierMap.get(tier);
  if (!tierDef) return null;

  // Grant free reward
  await grantReward(userId, tierDef.freeReward, profile.sackLevel);

  // Grant premium reward if premium
  let premiumReward: BattlePassReward | null = null;
  if (profile.battlepassPremium) {
    await grantReward(userId, tierDef.premiumReward, profile.sackLevel);
    premiumReward = tierDef.premiumReward;
  }

  // Mark as claimed
  await db
    .update(fishingProfile)
    .set({ battlepassClaimed: [...claimed, tier] })
    .where(eq(fishingProfile.userId, userId));

  return { free: tierDef.freeReward, premium: premiumReward };
}

async function grantReward(userId: string, reward: BattlePassReward, sackLevel: number) {
  switch (reward.type) {
    case "coins":
      await addCoins(userId, reward.amount);
      break;
    case "gems":
      await addGems(userId, reward.amount);
      break;
    case "bait":
      if (reward.id) await addItem(userId, reward.id, "bait", reward.amount, sackLevel);
      break;
    case "potion":
      if (reward.id) await addItem(userId, reward.id, "misc", reward.amount, sackLevel);
      break;
    case "title":
      if (reward.id) await unlockAchievement(userId, `__battlepass_${reward.id}`);
      break;
  }
}

/**
 * Activate premium battle pass for a user (called after Discord entitlement is granted).
 * This is the single source of truth for turning on premium — used by both
 * the entitlementCreate event and the gem-based fallback.
 */
export async function activatePremium(userId: string): Promise<void> {
  await resetIfNewSeason(userId);
  await db
    .update(fishingProfile)
    .set({ battlepassPremium: true })
    .where(eq(fishingProfile.userId, userId));
}

/**
 * Check if a user has a valid (non-expired, non-consumed) battle pass entitlement
 * for the current season via the Discord API.
 */
export async function checkEntitlementPremium(
  client: import("discord.js").Client,
  userId: string,
  skuId: string,
): Promise<boolean> {
  try {
    const entitlements = await client.application!.entitlements.fetch({
      user: userId,
      skus: [skuId],
      excludeEnded: true,
      excludeDeleted: true,
    });
    return entitlements.size > 0;
  } catch {
    return false;
  }
}

/**
 * Consume a one-time-purchase entitlement after the season ends (called during season reset).
 * This marks the entitlement as consumed so Discord allows re-purchase next season.
 */
export async function consumeEntitlement(
  client: import("discord.js").Client,
  userId: string,
  skuId: string,
): Promise<void> {
  try {
    const entitlements = await client.application!.entitlements.fetch({
      user: userId,
      skus: [skuId],
    });
    for (const [, entitlement] of entitlements) {
      if (!entitlement.consumed) {
        await entitlement.consume();
      }
    }
  } catch {
    // Silently fail — entitlement may already be consumed or deleted
  }
}

/** Upgrade to premium battle pass via gems (fallback when SKU is not configured) */
export async function upgradeToPremiumWithGems(userId: string): Promise<boolean> {
  const { subtractGems } = await import("./economy");
  const paid = await subtractGems(userId, 500);
  if (!paid) return false;

  await activatePremium(userId);
  return true;
}
