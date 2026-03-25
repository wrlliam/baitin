import { db } from "@/db";
import { playerUpgrades } from "@/db/schema";
import type { PlayerUpgradesSelect } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/utils/misc";

export async function getOrCreateUpgrades(userId: string): Promise<PlayerUpgradesSelect> {
  const existing = await db
    .select()
    .from(playerUpgrades)
    .where(eq(playerUpgrades.userId, userId));

  if (existing[0]) return existing[0];

  const id = createId();
  await db
    .insert(playerUpgrades)
    .values({ id, userId })
    .onConflictDoNothing({ target: playerUpgrades.userId });

  const created = await db
    .select()
    .from(playerUpgrades)
    .where(eq(playerUpgrades.userId, userId));

  return created[0]!;
}

export async function setUpgradeField(userId: string, upgradeId: string, newTier: number): Promise<void> {
  await getOrCreateUpgrades(userId); // ensure row exists

  const updates: Record<string, unknown> = {};

  switch (upgradeId) {
    case "auto_sell":
      updates.autoSellEnabled = true;
      break;
    case "multi_cast":
      updates.multiCastTier = newTier;
      break;
    case "auto_join_tournament":
      updates.autoJoinTournament = true;
      break;
    case "deep_sea_sonar":
      // Default whitelist: rare, epic, legendary, mythic
      updates.deepSeaSonarRarities = ["rare", "epic", "legendary", "mythic"];
      break;
    case "bait_compressor":
      updates.baitCompressor = true;
      break;
    case "tackle_box":
      updates.tackleBoxLevel = newTier;
      break;
    case "chum_streamer":
      updates.chumStreamer = true;
      break;
    case "tax_haven":
      updates.taxHavenLicense = true;
      break;
    case "high_tension_line":
      updates.highTensionLine = true;
      break;
  }

  await db
    .update(playerUpgrades)
    .set(updates)
    .where(eq(playerUpgrades.userId, userId));
}

export async function incrementCastCount(userId: string): Promise<number> {
  const upg = await getOrCreateUpgrades(userId);
  const newCount = upg.castCount + 1;
  await db
    .update(playerUpgrades)
    .set({ castCount: newCount })
    .where(eq(playerUpgrades.userId, userId));
  return newCount;
}
