import { db } from "@/db";
import { hut, hutInventory, hutNotifications, fishingProfile } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { hutSpeedUpgrades, hutLuckUpgrades, hutInventoryUpgrades, rodItems, allItems } from "@/data";
import { fish as fishData } from "@/data/fish";
import { junk as junkData } from "@/data/junk";
import { getOrCreateProfile, subtractCoins, addCoins } from "./economy";
import { removeItem } from "./inventory";
import config from "@/config";
import type { Client } from "discord.js";
import type { Fish, JunkItem } from "@/data/types";

export async function getHut(userId: string) {
  const rows = await db.select().from(hut).where(eq(hut.userId, userId));
  return rows[0] ?? null;
}

export async function createHut(userId: string): Promise<{ success: false; error: string } | { success: true; data: Awaited<ReturnType<typeof getHut>> }> {
  const existing = await getHut(userId);
  if (existing) return { success: true, data: existing };

  // Check permit
  const profileRows = await db.select().from(fishingProfile).where(eq(fishingProfile.userId, userId));
  const profile = profileRows[0];
  if (!profile?.hutOwned) {
    return { success: false, error: "no_permit" };
  }

  const id = createId();
  await db.insert(hut).values({ id, userId });
  const data = (await db.select().from(hut).where(eq(hut.userId, userId)))[0]!;
  return { success: true, data };
}

export async function collectHut(userId: string): Promise<{ items: { id: string; name: string; emoji: string; quantity: number }[]; total: number } | null> {
  const hutData = await getHut(userId);
  if (!hutData) return null;

  const speedUpgrade = hutSpeedUpgrades.find((u) => u.level === hutData.speedLevel);
  const minutesPerCatch = speedUpgrade?.speedMinutes ?? 60;
  const luckUpgrade = hutLuckUpgrades.find((u) => u.level === hutData.luckLevel);
  const luckBonus = luckUpgrade?.luckBonus ?? 0;
  const invUpgrade = hutInventoryUpgrades.find((u) => u.level === hutData.inventoryLevel);
  const maxItems = invUpgrade?.capacity ?? 12;

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
  let currentRodDurability = hutData.rodDurability;

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

    // Decrement rod durability for hut (if rod has durability)
    if (rod && rod.durability > 0 && currentRodDurability !== null && currentRodDurability !== undefined) {
      currentRodDurability--;
      if (currentRodDurability <= 0) {
        // Rod breaks in hut — clear it
        await db.update(hut).set({ rodId: null, rodDurability: null }).where(eq(hut.id, hutData.id));
        currentRodDurability = null;
      }
    }
  }

  // Update hut rod durability if it changed and rod hasn't broken
  if (rod && rod.durability > 0 && currentRodDurability !== null && currentRodDurability !== hutData.rodDurability) {
    await db.update(hut).set({ rodDurability: currentRodDurability }).where(eq(hut.id, hutData.id));
  }

  // Store in hut inventory — batch upsert with ON CONFLICT
  const upsertValues = Array.from(caughtItems, ([itemId, data]) => ({
    id: createId(),
    hutId: hutData.id,
    itemId,
    itemType: fishData.find((f) => f.id === itemId) ? "fish" as const : "junk" as const,
    quantity: data.quantity,
  }));

  if (upsertValues.length > 0) {
    await db
      .insert(hutInventory)
      .values(upsertValues)
      .onConflictDoUpdate({
        target: [hutInventory.hutId, hutInventory.itemId],
        set: { quantity: sql`${hutInventory.quantity} + excluded.quantity` },
      });
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

export async function setHutRod(userId: string, rodId: string): Promise<{ success: boolean; error?: string; previousRodId?: string }> {
  const hutData = await getHut(userId);
  if (!hutData) return { success: false, error: "You don't have a hut yet!" };

  const rod = rodItems.get(rodId);
  if (!rod) return { success: false, error: "Invalid rod." };

  // Remove rod from user inventory
  const removed = await removeItem(userId, rodId, 1);
  if (!removed) return { success: false, error: "You don't have this rod in your sack." };

  const previousRodId = hutData.rodId ?? undefined;
  const rodDurability = rod.durability === 0 ? null : rod.durability;
  await db.update(hut).set({ rodId, rodDurability }).where(eq(hut.id, hutData.id));
  return { success: true, previousRodId };
}

export async function setHutPet(userId: string, petId: string | null): Promise<{ success: boolean; error?: string }> {
  const hutData = await getHut(userId);
  if (!hutData) return { success: false, error: "You don't have a hut yet!" };

  await db.update(hut).set({ petId }).where(eq(hut.id, hutData.id));
  return { success: true };
}

export async function sellHutItems(
  userId: string,
  itemId?: string
): Promise<{ success: boolean; error?: string; totalCoins: number; itemCount: number }> {
  const hutData = await getHut(userId);
  if (!hutData) return { success: false, error: "You don't have a hut yet!", totalCoins: 0, itemCount: 0 };

  const invRows = await db
    .select()
    .from(hutInventory)
    .where(eq(hutInventory.hutId, hutData.id));

  const toSell = itemId ? invRows.filter((r) => r.itemId === itemId) : invRows;
  if (toSell.length === 0) return { success: false, error: "Nothing to sell.", totalCoins: 0, itemCount: 0 };

  let totalCoins = 0;
  let itemCount = 0;

  for (const row of toSell) {
    const item = allItems.get(row.itemId);
    if (!item) continue;

    const coins = Math.floor(item.price * config.fishing.sellPriceMultiplier * row.quantity);
    await db.delete(hutInventory).where(eq(hutInventory.id, row.id));
    await addCoins(userId, coins);
    totalCoins += coins;
    itemCount += row.quantity;
  }

  return { success: true, totalCoins, itemCount };
}

export async function processHutCatch(
  hutData: Awaited<ReturnType<typeof getHut>>,
  client: Client
): Promise<void> {
  if (!hutData) return;

  const result = await collectHut(hutData.userId);
  if (!result || result.items.length === 0) return;

  const messagePayload = {
    content: `${config.emojis.hut} **Your hut caught some fish!**\n${result.items
      .map((i) => `${i.emoji} **${i.name}** ×${i.quantity}`)
      .join("\n")}`,
  };

  try {
    const user = await client.users.fetch(hutData.userId);
    await user.send(messagePayload);
  } catch {
    // DiscordAPIError 50007: Cannot send messages to this user — store as notification
    await db.insert(hutNotifications).values({
      id: createId(),
      userId: hutData.userId,
      message: JSON.stringify(result.items),
    });
  }
}

export async function runHutCron(client: Client): Promise<void> {
  const PAGE_SIZE = 100;
  let offset = 0;

  while (true) {
    const page = await db.select().from(hut).limit(PAGE_SIZE).offset(offset);
    if (page.length === 0) break;

    for (const hutData of page) {
      try {
        await processHutCatch(hutData, client);
      } catch {
        // Skip individual hut failures so remaining huts still process
      }
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
}

export async function getHutNotifications(userId: string) {
  return db
    .select()
    .from(hutNotifications)
    .where(eq(hutNotifications.userId, userId));
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await db
    .update(hutNotifications)
    .set({ read: true })
    .where(eq(hutNotifications.userId, userId));
}
