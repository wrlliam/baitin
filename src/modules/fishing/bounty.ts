import { db } from "@/db";
import { bounty } from "@/db/schema";
import { eq, and, sql, gt, desc } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { subtractCoins, addCoins } from "./economy";

const BOUNTY_EXPIRY_HOURS = 72;
const MAX_ACTIVE_PER_PLACER = 3;
const MIN_BOUNTY = 500;
const MAX_BOUNTY = 50000;

export async function placeBounty(
  placerId: string,
  targetId: string,
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  if (amount < MIN_BOUNTY) {
    return { success: false, error: `Minimum bounty is ${MIN_BOUNTY.toLocaleString()} coins.` };
  }
  if (amount > MAX_BOUNTY) {
    return { success: false, error: `Maximum bounty is ${MAX_BOUNTY.toLocaleString()} coins.` };
  }

  // Check active bounty count
  const active = await db
    .select()
    .from(bounty)
    .where(and(eq(bounty.placerId, placerId), eq(bounty.status, "active")));

  if (active.length >= MAX_ACTIVE_PER_PLACER) {
    return { success: false, error: `You can only have ${MAX_ACTIVE_PER_PLACER} active bounties at a time.` };
  }

  const paid = await subtractCoins(placerId, amount);
  if (!paid) {
    return { success: false, error: "You don't have enough coins." };
  }

  const expiresAt = new Date(Date.now() + BOUNTY_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.insert(bounty).values({
    id: createId(),
    placerId,
    targetId,
    amount,
    expiresAt,
  });

  return { success: true };
}

export async function getActiveBounties(limit = 10) {
  await expireBounties();

  return db
    .select()
    .from(bounty)
    .where(eq(bounty.status, "active"))
    .orderBy(desc(bounty.amount))
    .limit(limit);
}

export async function getActiveBountiesOnTarget(targetId: string) {
  return db
    .select()
    .from(bounty)
    .where(and(eq(bounty.targetId, targetId), eq(bounty.status, "active")));
}

export async function claimBounties(
  targetId: string,
  claimerId: string,
): Promise<{ totalClaimed: number; count: number }> {
  const activeBounties = await getActiveBountiesOnTarget(targetId);
  if (activeBounties.length === 0) return { totalClaimed: 0, count: 0 };

  let totalClaimed = 0;
  for (const b of activeBounties) {
    await db
      .update(bounty)
      .set({ status: "claimed", claimedBy: claimerId })
      .where(eq(bounty.id, b.id));
    totalClaimed += b.amount;
  }

  if (totalClaimed > 0) {
    await addCoins(claimerId, totalClaimed);
  }

  return { totalClaimed, count: activeBounties.length };
}

export async function expireBounties(): Promise<number> {
  const now = new Date();
  const expired = await db
    .select()
    .from(bounty)
    .where(and(eq(bounty.status, "active"), sql`${bounty.expiresAt} <= ${now}`));

  for (const b of expired) {
    await db
      .update(bounty)
      .set({ status: "expired" })
      .where(eq(bounty.id, b.id));
    // Refund placer
    await addCoins(b.placerId, b.amount);
  }

  return expired.length;
}
