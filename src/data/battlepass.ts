export interface BattlePassReward {
  type: "coins" | "gems" | "bait" | "potion" | "title";
  id?: string; // item/title ID for non-currency rewards
  amount: number;
  label: string;
  emoji: string;
}

export interface BattlePassTier {
  tier: number;
  xpRequired: number; // XP to reach this tier from the previous one
  freeReward: BattlePassReward;
  premiumReward: BattlePassReward;
}

export const PREMIUM_COST = 500; // gems

/** 30 tiers of battle pass rewards */
export const battlePassTiers: BattlePassTier[] = Array.from({ length: 30 }, (_, i) => {
  const tier = i + 1;
  const xpRequired = tier * 100;

  // Free rewards: escalating coins, gems every 5 tiers
  let freeReward: BattlePassReward;
  if (tier % 5 === 0) {
    freeReward = {
      type: "gems",
      amount: 1,
      label: "1 Gem",
      emoji: "💎",
    };
  } else if (tier % 3 === 0) {
    freeReward = {
      type: "bait",
      id: "nightcrawler",
      amount: 5,
      label: "5× Nightcrawler",
      emoji: "🪱",
    };
  } else {
    freeReward = {
      type: "coins",
      amount: tier * 200,
      label: `${(tier * 200).toLocaleString()} Coins`,
      emoji: "🪙",
    };
  }

  // Premium rewards: better versions
  let premiumReward: BattlePassReward;
  if (tier === 30) {
    premiumReward = {
      type: "title",
      id: "battle_pass_champion",
      amount: 1,
      label: "Battle Pass Champion Title",
      emoji: "🏅",
    };
  } else if (tier === 20) {
    premiumReward = {
      type: "gems",
      amount: 10,
      label: "10 Gems",
      emoji: "💎",
    };
  } else if (tier === 10) {
    premiumReward = {
      type: "bait",
      id: "golden_lure",
      amount: 3,
      label: "3× Golden Lure",
      emoji: "✨",
    };
  } else if (tier % 3 === 0) {
    premiumReward = {
      type: "gems",
      amount: 2,
      label: "2 Gems",
      emoji: "💎",
    };
  } else {
    premiumReward = {
      type: "coins",
      amount: tier * 400,
      label: `${(tier * 400).toLocaleString()} Coins`,
      emoji: "🪙",
    };
  }

  return { tier, xpRequired, freeReward, premiumReward };
});

export const battlePassTierMap = new Map(battlePassTiers.map((t) => [t.tier, t]));

/** Total XP needed to reach a given tier (cumulative) */
export function cumulativeXpForTier(tier: number): number {
  let total = 0;
  for (let i = 1; i <= tier; i++) {
    total += i * 100;
  }
  return total;
}
