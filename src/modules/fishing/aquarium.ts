import { db } from "@/db";
import { aquarium, aquariumFish } from "@/db/schema";
import { eq } from "drizzle-orm";
import { allItems } from "@/data";
import { addCoins, subtractGems } from "./economy";
import { removeItem, getItemQuantity } from "./inventory";
import { createId } from "@/utils/misc";
import type { ItemRarity } from "@/data/types";

const HOURLY_RATES: Record<string, number> = {
  common: 1,
  uncommon: 3,
  rare: 10,
  epic: 30,
  legendary: 100,
  mythic: 300,
};

const UPGRADE_COST = 50; // gems
const UPGRADE_SLOTS = 4;

export async function getOrCreateAquarium(userId: string) {
  const rows = await db.select().from(aquarium).where(eq(aquarium.userId, userId));
  if (rows[0]) return rows[0];

  const newAq = {
    id: createId(),
    userId,
    maxSlots: 12,
    lastCollectedAt: new Date(),
  };
  await db.insert(aquarium).values(newAq);
  return newAq;
}

export async function getAquariumFish(aquariumId: string) {
  return db.select().from(aquariumFish).where(eq(aquariumFish.aquariumId, aquariumId));
}

export async function placeFish(
  userId: string,
  fishId: string,
): Promise<{ success: boolean; error?: string }> {
  const aq = await getOrCreateAquarium(userId);
  const currentFish = await getAquariumFish(aq.id);

  if (currentFish.length >= aq.maxSlots) {
    return { success: false, error: `Aquarium is full (${aq.maxSlots} slots). Upgrade or remove a fish first.` };
  }

  // Check user has the fish in inventory
  const qty = await getItemQuantity(userId, fishId);
  if (qty <= 0) {
    return { success: false, error: "You don't have that fish in your inventory." };
  }

  const item = allItems.get(fishId);
  if (!item || item.category !== "fish") {
    return { success: false, error: "That item is not a fish." };
  }

  await removeItem(userId, fishId, 1);
  await db.insert(aquariumFish).values({
    id: createId(),
    aquariumId: aq.id,
    fishId,
  });

  return { success: true };
}

export async function removeFishFromAquarium(
  userId: string,
  fishEntryId: string,
): Promise<{ success: boolean; fishId?: string; error?: string }> {
  const aq = await getOrCreateAquarium(userId);
  const fish = await getAquariumFish(aq.id);
  const entry = fish.find((f) => f.id === fishEntryId);

  if (!entry) {
    return { success: false, error: "That fish isn't in your aquarium." };
  }

  await db.delete(aquariumFish).where(eq(aquariumFish.id, fishEntryId));

  // Return fish to inventory
  const { addItem } = await import("./inventory");
  await addItem(userId, entry.fishId, "fish", 1);

  return { success: true, fishId: entry.fishId };
}

export async function collectIncome(
  userId: string,
): Promise<{ coins: number; hours: number }> {
  const aq = await getOrCreateAquarium(userId);
  const fish = await getAquariumFish(aq.id);

  if (fish.length === 0) return { coins: 0, hours: 0 };

  const now = Date.now();
  const lastCollected = aq.lastCollectedAt?.getTime() ?? now;
  const elapsedMs = now - lastCollected;
  const elapsedHours = Math.min(24, elapsedMs / 3_600_000);

  if (elapsedHours < 0.01) return { coins: 0, hours: 0 };

  const totalPerHour = fish.reduce((sum, f) => {
    const item = allItems.get(f.fishId);
    if (!item) return sum;
    return sum + (HOURLY_RATES[item.rarity] ?? 0);
  }, 0);

  const coins = Math.floor(totalPerHour * elapsedHours);

  if (coins > 0) {
    await addCoins(userId, coins);
    await db
      .update(aquarium)
      .set({ lastCollectedAt: new Date() })
      .where(eq(aquarium.id, aq.id));
  }

  return { coins, hours: Math.floor(elapsedHours) };
}

export async function upgradeAquarium(
  userId: string,
): Promise<{ success: boolean; newMax?: number; error?: string }> {
  const aq = await getOrCreateAquarium(userId);

  if (aq.maxSlots >= 20) {
    return { success: false, error: "Aquarium is already at max capacity (20 slots)." };
  }

  const paid = await subtractGems(userId, UPGRADE_COST);
  if (!paid) {
    return { success: false, error: `Not enough gems. You need **${UPGRADE_COST}** 💎.` };
  }

  const newMax = aq.maxSlots + UPGRADE_SLOTS;
  await db
    .update(aquarium)
    .set({ maxSlots: newMax })
    .where(eq(aquarium.id, aq.id));

  return { success: true, newMax };
}

export function getHourlyRate(rarity: string): number {
  return HOURLY_RATES[rarity] ?? 0;
}
