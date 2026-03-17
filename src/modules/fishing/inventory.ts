import { db } from "@/db";
import { fishingInventory } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { sackTiers } from "@/data";
import { getOrCreateProfile } from "./economy";

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
