/**
 * Reputation perk thresholds — checked at point-of-use, no schema changes needed.
 *
 * | Rep  | Perk                              |
 * |------|-----------------------------------|
 * | 10   | -5% shop prices                   |
 * | 25   | +1 daily quest slot (4 vs 3)      |
 * | 50   | +10% sell bonus (stacks with Tax Haven) |
 * | 100  | +5% XP bonus (permanent)          |
 * | 250  | Exclusive title: "Beloved"        |
 */

export interface RepPerks {
  shopDiscount: number; // 0–1 fraction off shop prices
  extraQuestSlot: boolean;
  sellBonus: number; // 0–1 fraction added to sell price
  xpBonus: number; // 0–1 fraction added to XP
  belovedTitle: boolean;
}

export function getRepPerks(reputation: number): RepPerks {
  return {
    shopDiscount: reputation >= 10 ? 0.05 : 0,
    extraQuestSlot: reputation >= 25,
    sellBonus: reputation >= 50 ? 0.1 : 0,
    xpBonus: reputation >= 100 ? 0.05 : 0,
    belovedTitle: reputation >= 250,
  };
}

/** Human-readable summary of unlocked perks for display */
export function getRepPerksSummary(reputation: number): string[] {
  const lines: string[] = [];
  if (reputation >= 10) lines.push("🏷️ **-5% Shop Prices**");
  if (reputation >= 25) lines.push("📜 **+1 Daily Quest Slot**");
  if (reputation >= 50) lines.push("💰 **+10% Sell Bonus**");
  if (reputation >= 100) lines.push("📖 **+5% XP Bonus**");
  if (reputation >= 250) lines.push("🏅 **Title: Beloved**");
  return lines;
}
