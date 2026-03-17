import { db } from "@/db";
import { hut, hutInventory } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { hutSpeedUpgrades, hutLuckUpgrades, hutInventoryUpgrades, rodItems } from "@/data";
import { fish as fishData } from "@/data/fish";
import { junk as junkData } from "@/data/junk";
import { getOrCreateProfile, subtractCoins } from "./economy";
import { removeItem } from "./inventory";
import type { Fish, JunkItem } from "@/data/types";

export async function getHut(userId: string) {
  const rows = await db.select().from(hut).where(eq(hut.userId, userId));
  return rows[0] ?? null;
}

export async function createHut(userId: string) {
  const existing = await getHut(userId);
  if (existing) return existing;

  const id = createId();
  await db.insert(hut).values({ id, userId });
  return (await db.select().from(hut).where(eq(hut.userId, userId)))[0]!;
}

export async function collectHut(userId: string): Promise<{ items: { id: string; name: string; emoji: string; quantity: number }[]; total: number } | null> {
  const hutData = await getHut(userId);
  if (!hutData) return null;

  const speedUpgrade = hutSpeedUpgrades.find((u) => u.level === hutData.speedLevel);
  const minutesPerCatch = speedUpgrade?.speedMinutes ?? 60;
  const luckUpgrade = hutLuckUpgrades.find((u) => u.level === hutData.luckLevel);
  const luckBonus = luckUpgrade?.luckBonus ?? 0;
  const invUpgrade = hutInventoryUpgrades.find((u) => u.level === hutData.inventoryLevel);
  const maxItems = invUpgrade?.capacity ?? 10;

  const now = new Date();
  const lastCollected = hutData.lastCollectedAt ?? now;
  const elapsedMs = now.getTime() - lastCollected.getTime();
  const elapsedMinutes = elapsedMs / (60 * 1000);

  let catches = Math.floor(elapsedMinutes / minutesPerCatch);
  catches = Math.min(catches, 24, maxItems);

  if (catches <= 0) return { items: [], total: 0 };

  // Roll simplified catches
  const caughtItems: Map<string, { id: string; name: string; emoji: string; quantity: number }> = new Map();
  const rod = hutData.rodId ? rodItems.get(hutData.rodId) : null;

  for (let i = 0; i < catches; i++) {
    let junkChance = 0.25;
    if (rod) junkChance -= rod.luckBonus * 0.5;
    junkChance -= luckBonus * 0.3;
    junkChance = Math.max(0.05, junkChance);

    const isJunk = Math.random() < junkChance;
    const pool = isJunk ? junkData : fishData;
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * totalWeight;
    let caught: Fish | JunkItem = pool[pool.length - 1];
    for (const item of pool) {
      r -= item.weight;
      if (r <= 0) { caught = item; break; }
    }

    const existing = caughtItems.get(caught.id);
    if (existing) {
      existing.quantity++;
    } else {
      caughtItems.set(caught.id, { id: caught.id, name: caught.name, emoji: caught.emoji, quantity: 1 });
    }
  }

  // Store in hut inventory
  for (const [itemId, data] of caughtItems) {
    const existingRows = await db
      .select()
      .from(hutInventory)
      .where(sql`${hutInventory.hutId} = ${hutData.id} AND ${hutInventory.itemId} = ${itemId}`);

    if (existingRows[0]) {
      await db
        .update(hutInventory)
        .set({ quantity: sql`${hutInventory.quantity} + ${data.quantity}` })
        .where(eq(hutInventory.id, existingRows[0].id));
    } else {
      const category = fishData.find((f) => f.id === itemId) ? "fish" : "junk";
      await db.insert(hutInventory).values({
        id: createId(),
        hutId: hutData.id,
        itemId,
        itemType: category,
        quantity: data.quantity,
      });
    }
  }

  // Update last collected
  await db.update(hut).set({ lastCollectedAt: now }).where(eq(hut.id, hutData.id));

  return { items: Array.from(caughtItems.values()), total: catches };
}

export async function getHutInventory(userId: string) {
  const hutData = await getHut(userId);
  if (!hutData) return [];
  return db.select().from(hutInventory).where(eq(hutInventory.hutId, hutData.id));
}

export async function upgradeHut(
  userId: string,
  type: "speed" | "luck" | "inventory"
): Promise<{ success: boolean; error?: string; newLevel?: number }> {
  const hutData = await getHut(userId);
  if (!hutData) return { success: false, error: "You don't have a hut yet!" };

  let upgrades: typeof hutSpeedUpgrades;
  let currentLevel: number;

  if (type === "speed") {
    upgrades = hutSpeedUpgrades;
    currentLevel = hutData.speedLevel;
  } else if (type === "luck") {
    upgrades = hutLuckUpgrades;
    currentLevel = hutData.luckLevel;
  } else {
    upgrades = hutInventoryUpgrades;
    currentLevel = hutData.inventoryLevel;
  }

  const nextUpgrade = upgrades.find((u) => u.level === currentLevel + 1);
  if (!nextUpgrade) return { success: false, error: "Already at max level!" };

  const paid = await subtractCoins(userId, nextUpgrade.cost);
  if (!paid) return { success: false, error: `Not enough coins! Need $${nextUpgrade.cost.toLocaleString()}.` };

  const updateField =
    type === "speed" ? { speedLevel: currentLevel + 1 } :
    type === "luck" ? { luckLevel: currentLevel + 1 } :
    { inventoryLevel: currentLevel + 1 };

  await db.update(hut).set(updateField).where(eq(hut.id, hutData.id));

  return { success: true, newLevel: currentLevel + 1 };
}

export async function setHutRod(userId: string, rodId: string): Promise<{ success: boolean; error?: string }> {
  const hutData = await getHut(userId);
  if (!hutData) return { success: false, error: "You don't have a hut yet!" };

  const rod = rodItems.get(rodId);
  if (!rod) return { success: false, error: "Invalid rod." };

  // Remove rod from user inventory
  const removed = await removeItem(userId, rodId, 1);
  if (!removed) return { success: false, error: "You don't have this rod in your sack." };

  await db.update(hut).set({ rodId }).where(eq(hut.id, hutData.id));
  return { success: true };
}

export async function setHutPet(userId: string, petId: string | null): Promise<{ success: boolean; error?: string }> {
  const hutData = await getHut(userId);
  if (!hutData) return { success: false, error: "You don't have a hut yet!" };

  await db.update(hut).set({ petId }).where(eq(hut.id, hutData.id));
  return { success: true };
}
