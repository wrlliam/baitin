import { db } from "@/db";
import { fishingInventory } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { sackTiers, allItems } from "@/data";
import { getOrCreateProfile } from "./economy";
import { addCoins } from "./economy";
import config from "@/config";
import type { ItemCategory } from "@/data/types";

export async function addItem(
  userId: string,
  itemId: string,
  itemType: string,
  qty: number = 1
): Promise<boolean> {
  const count = await getItemCount(userId);
  const capacity = await getSackCapacity(userId);

  if (count + qty > capacity) return false;

  const existing = await db
    .select()
    .from(fishingInventory)
    .where(
      and(
        eq(fishingInventory.userId, userId),
        eq(fishingInventory.itemId, itemId)
      )
    );

  if (existing[0]) {
    await db
      .update(fishingInventory)
      .set({ quantity: sql`${fishingInventory.quantity} + ${qty}` })
      .where(eq(fishingInventory.id, existing[0].id));
  } else {
    await db.insert(fishingInventory).values({
      id: createId(),
      userId,
      itemId,
      itemType,
      quantity: qty,
    });
  }

  return true;
}

export async function removeItem(
  userId: string,
  itemId: string,
  qty: number = 1
): Promise<boolean> {
  const existing = await db
    .select()
    .from(fishingInventory)
    .where(
      and(
        eq(fishingInventory.userId, userId),
        eq(fishingInventory.itemId, itemId)
      )
    );

  if (!existing[0] || existing[0].quantity < qty) return false;

  if (existing[0].quantity === qty) {
    await db
      .delete(fishingInventory)
      .where(eq(fishingInventory.id, existing[0].id));
  } else {
    await db
      .update(fishingInventory)
      .set({ quantity: sql`${fishingInventory.quantity} - ${qty}` })
      .where(eq(fishingInventory.id, existing[0].id));
  }

  return true;
}

export async function getInventory(userId: string) {
  return db
    .select()
    .from(fishingInventory)
    .where(eq(fishingInventory.userId, userId));
}

export async function getSackCapacity(userId: string): Promise<number> {
  const profile = await getOrCreateProfile(userId);
  const tier = sackTiers.find((t) => t.level === profile.sackLevel);
  return tier?.capacity ?? 5;
}

export async function getItemCount(userId: string): Promise<number> {
  const items = await db
    .select()
    .from(fishingInventory)
    .where(eq(fishingInventory.userId, userId));

  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export async function getItemQuantity(userId: string, itemId: string): Promise<number> {
  const existing = await db
    .select()
    .from(fishingInventory)
    .where(
      and(
        eq(fishingInventory.userId, userId),
        eq(fishingInventory.itemId, itemId)
      )
    );

  return existing[0]?.quantity ?? 0;
}

const UNSELLABLE_ITEMS = new Set(["hut_permit"]);

export async function sellItem(
  userId: string,
  itemId: string,
  qty: number = 1
): Promise<{ success: boolean; error?: string; coinsGained?: number }> {
  if (UNSELLABLE_ITEMS.has(itemId)) return { success: false, error: "This item cannot be sold." };
  const item = allItems.get(itemId);
  if (!item) return { success: false, error: "Unknown item." };

  const removed = await removeItem(userId, itemId, qty);
  if (!removed) return { success: false, error: "You don't have enough of that item." };

  const coinsGained = Math.floor(item.price * config.fishing.sellPriceMultiplier * qty);
  await addCoins(userId, coinsGained);

  return { success: true, coinsGained };
}

export async function sellAll(
  userId: string,
  exclude: ItemCategory[] = ["rod", "pet", "egg", "misc"]
): Promise<{ success: boolean; totalCoins: number; itemCount: number }> {
  const inventory = await getInventory(userId);
  let totalCoins = 0;
  let itemCount = 0;

  for (const row of inventory) {
    if (exclude.includes(row.itemType as ItemCategory)) continue;

    const item = allItems.get(row.itemId);
    if (!item) continue;

    const coins = Math.floor(item.price * config.fishing.sellPriceMultiplier * row.quantity);
    await db.delete(fishingInventory).where(eq(fishingInventory.id, row.id));
    await addCoins(userId, coins);
    totalCoins += coins;
    itemCount += row.quantity;
  }

  return { success: true, totalCoins, itemCount };
}
