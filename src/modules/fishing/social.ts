import { db } from "@/db";
import { fishingProfile, fishingInventory, tradeLog } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { redis } from "@/db/redis";
import { addCoins, subtractCoins, getOrCreateProfile } from "./economy";
import { addItem, removeItem, getInventory } from "./inventory";
import { createId } from "@/utils/misc";

const GIVE_TAX_RATE = 0.05;
const GIVE_MIN_COINS = 100;
const REP_COOLDOWN_TTL = 86400; // 24 hours

export async function giveCoins(
  senderId: string,
  receiverId: string,
  amount: number,
): Promise<{ success: boolean; error?: string; taxed: number; received: number }> {
  if (amount < GIVE_MIN_COINS) {
    return { success: false, error: `Minimum gift is ${GIVE_MIN_COINS} coins.`, taxed: 0, received: 0 };
  }

  const paid = await subtractCoins(senderId, amount);
  if (!paid) {
    return { success: false, error: "You don't have enough coins.", taxed: 0, received: 0 };
  }

  const tax = Math.floor(amount * GIVE_TAX_RATE);
  const received = amount - tax;
  await addCoins(receiverId, received);

  return { success: true, taxed: tax, received };
}

export async function giveItem(
  senderId: string,
  receiverId: string,
  itemId: string,
  itemType: string,
): Promise<{ success: boolean; error?: string }> {
  const removed = await removeItem(senderId, itemId, 1);
  if (!removed) {
    return { success: false, error: "You don't have that item." };
  }

  const added = await addItem(receiverId, itemId, itemType, 1);
  if (!added) {
    // Refund if receiver sack is full
    await addItem(senderId, itemId, itemType, 1);
    return { success: false, error: "Their sack is full!" };
  }

  return { success: true };
}

export async function canGiveRep(giverId: string): Promise<{ ok: boolean; expiresAt?: number }> {
  const val = await redis.get(`rep:cd:${giverId}`);
  if (!val) return { ok: true };
  return { ok: false, expiresAt: parseInt(val) };
}

export async function giveRep(
  giverId: string,
  receiverId: string,
): Promise<{ success: boolean; error?: string; newRep?: number }> {
  const cd = await canGiveRep(giverId);
  if (!cd.ok) {
    return { success: false, error: `You can give rep again <t:${Math.floor(cd.expiresAt! / 1000)}:R>.` };
  }

  await getOrCreateProfile(receiverId);

  const [updated] = await db
    .update(fishingProfile)
    .set({ reputation: sql`${fishingProfile.reputation} + 1` })
    .where(eq(fishingProfile.userId, receiverId))
    .returning({ reputation: fishingProfile.reputation });

  const expiresAt = Date.now() + REP_COOLDOWN_TTL * 1000;
  await redis.send("SETEX", [`rep:cd:${giverId}`, REP_COOLDOWN_TTL.toString(), expiresAt.toString()]);

  return { success: true, newRep: updated?.reputation };
}

export async function pickRandomItem(userId: string): Promise<{ itemId: string; itemType: string } | null> {
  const inventory = await getInventory(userId);
  // Exclude rods and equipped items
  const giftable = inventory.filter(
    (i) => !["rod"].includes(i.itemType),
  );

  if (giftable.length === 0) return null;

  const pick = giftable[Math.floor(Math.random() * giftable.length)];
  return { itemId: pick.itemId, itemType: pick.itemType };
}

interface TradeItem {
  itemId: string;
  itemType: string;
  qty: number;
}

export async function executeTrade(
  initiatorId: string,
  targetId: string,
  initiatorItems: TradeItem[],
  targetItems: TradeItem[],
): Promise<{ success: boolean; error?: string }> {
  // Remove all items first
  for (const item of initiatorItems) {
    const removed = await removeItem(initiatorId, item.itemId, item.qty);
    if (!removed) {
      return { success: false, error: `Failed to remove ${item.itemId} from initiator.` };
    }
  }
  for (const item of targetItems) {
    const removed = await removeItem(targetId, item.itemId, item.qty);
    if (!removed) {
      // Refund initiator items
      for (const refund of initiatorItems) {
        await addItem(initiatorId, refund.itemId, refund.itemType, refund.qty);
      }
      return { success: false, error: `Failed to remove ${item.itemId} from target.` };
    }
  }

  // Add items
  for (const item of initiatorItems) {
    await addItem(targetId, item.itemId, item.itemType, item.qty);
  }
  for (const item of targetItems) {
    await addItem(initiatorId, item.itemId, item.itemType, item.qty);
  }

  // Log the trade
  await db.insert(tradeLog).values({
    id: createId(),
    initiatorId,
    targetId,
    initiatorItems,
    targetItems,
  });

  return { success: true };
}
