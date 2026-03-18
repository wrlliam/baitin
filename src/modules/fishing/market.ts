import { db } from "@/db";
import { marketListing } from "@/db/schema";
import { eq, and, sql, desc, lt, count } from "drizzle-orm";
import { allItems } from "@/data";
import { createId } from "@/utils/misc";
import { removeItem, addItem } from "./inventory";
import { subtractCoins, addCoins } from "./economy";
import { checkEconomyAchievements } from "./achievements";

export async function createListing(
  sellerId: string,
  itemId: string,
  itemType: string,
  quantity: number,
  pricePerUnit: number,
  isAuction: boolean = false,
  durationMs?: number
): Promise<{ success: boolean; error?: string; listingId?: string }> {
  const removed = await removeItem(sellerId, itemId, quantity);
  if (!removed) return { success: false, error: "You don't have enough of this item." };

  const id = createId();
  const auctionEndAt = isAuction && durationMs
    ? new Date(Date.now() + durationMs)
    : null;

  await db.insert(marketListing).values({
    id,
    sellerId,
    itemId,
    itemType,
    quantity,
    pricePerUnit,
    isAuction,
    auctionEndAt,
    status: "active",
  });

  // Achievement: first market sale
  await checkEconomyAchievements(sellerId, { madeMarketSale: true });

  return { success: true, listingId: id };
}

export async function buyListing(
  buyerId: string,
  listingId: string
): Promise<{ success: boolean; error?: string }> {
  const listings = await db
    .select()
    .from(marketListing)
    .where(and(eq(marketListing.id, listingId), eq(marketListing.status, "active")));

  const listing = listings[0];
  if (!listing) return { success: false, error: "Listing not found or no longer active." };
  if (listing.isAuction) return { success: false, error: "This is an auction — use bid instead." };
  if (listing.sellerId === buyerId) return { success: false, error: "You can't buy your own listing." };

  const totalCost = listing.pricePerUnit * listing.quantity;
  const paid = await subtractCoins(buyerId, totalCost);
  if (!paid) return { success: false, error: "Not enough coins." };

  // Transfer item to buyer
  const added = await addItem(buyerId, listing.itemId, listing.itemType, listing.quantity);
  if (!added) {
    // Refund
    await addCoins(buyerId, totalCost);
    return { success: false, error: "Your sack is full!" };
  }

  // Pay seller
  await addCoins(listing.sellerId, totalCost);

  // Mark listing as sold
  await db
    .update(marketListing)
    .set({ status: "sold" })
    .where(eq(marketListing.id, listingId));

  return { success: true };
}

export async function placeBid(
  bidderId: string,
  listingId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const listings = await db
    .select()
    .from(marketListing)
    .where(and(eq(marketListing.id, listingId), eq(marketListing.status, "active")));

  const listing = listings[0];
  if (!listing) return { success: false, error: "Listing not found." };
  if (!listing.isAuction) return { success: false, error: "This is not an auction." };
  if (listing.sellerId === bidderId) return { success: false, error: "Can't bid on your own listing." };
  if (amount <= (listing.highestBid ?? 0)) return { success: false, error: "Bid must be higher than current highest bid." };

  const paid = await subtractCoins(bidderId, amount);
  if (!paid) return { success: false, error: "Not enough coins." };

  // Refund previous bidder
  if (listing.highestBidderId && listing.highestBid) {
    await addCoins(listing.highestBidderId, listing.highestBid);
  }

  await db
    .update(marketListing)
    .set({ highestBidderId: bidderId, highestBid: amount })
    .where(eq(marketListing.id, listingId));

  return { success: true };
}

export async function cancelListing(
  sellerId: string,
  listingId: string
): Promise<{ success: boolean; error?: string }> {
  const listings = await db
    .select()
    .from(marketListing)
    .where(and(eq(marketListing.id, listingId), eq(marketListing.sellerId, sellerId), eq(marketListing.status, "active")));

  const listing = listings[0];
  if (!listing) return { success: false, error: "Listing not found or already completed." };

  // Refund highest bidder if auction
  if (listing.isAuction && listing.highestBidderId && listing.highestBid) {
    await addCoins(listing.highestBidderId, listing.highestBid);
  }

  // Return items to seller
  await addItem(sellerId, listing.itemId, listing.itemType, listing.quantity);

  await db
    .update(marketListing)
    .set({ status: "cancelled" })
    .where(eq(marketListing.id, listingId));

  return { success: true };
}

export async function settleExpiredAuctions() {
  const expired = await db
    .select()
    .from(marketListing)
    .where(
      and(
        eq(marketListing.isAuction, true),
        eq(marketListing.status, "active"),
        lt(marketListing.auctionEndAt, new Date())
      )
    );

  for (const listing of expired) {
    if (listing.highestBidderId && listing.highestBid) {
      // Transfer to winner
      await addItem(listing.highestBidderId, listing.itemId, listing.itemType, listing.quantity);
      await addCoins(listing.sellerId, listing.highestBid);
      await db.update(marketListing).set({ status: "sold" }).where(eq(marketListing.id, listing.id));
    } else {
      // No bids — return to seller
      await addItem(listing.sellerId, listing.itemId, listing.itemType, listing.quantity);
      await db.update(marketListing).set({ status: "expired" }).where(eq(marketListing.id, listing.id));
    }
  }
}

export async function getListings(filters?: { category?: string; status?: string; page?: number; pageSize?: number }) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 10;
  const status = filters?.status ?? "active";

  const conditions = [eq(marketListing.status, status)];
  if (filters?.category) {
    conditions.push(eq(marketListing.itemType, filters.category));
  }

  const rows = await db
    .select()
    .from(marketListing)
    .where(and(...conditions))
    .orderBy(desc(marketListing.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return rows;
}

export async function getListingCount(filters?: { category?: string; status?: string }): Promise<number> {
  const status = filters?.status ?? "active";
  const conditions = [eq(marketListing.status, status)];
  if (filters?.category) {
    conditions.push(eq(marketListing.itemType, filters.category));
  }
  const result = await db.select({ value: count() }).from(marketListing).where(and(...conditions));
  return result[0]?.value ?? 0;
}

export async function getActiveListingCount(sellerId: string): Promise<number> {
  const result = await db
    .select({ value: count() })
    .from(marketListing)
    .where(and(eq(marketListing.sellerId, sellerId), eq(marketListing.status, "active")));

  return result[0]?.value ?? 0;
}

export function canAuction(itemId: string): boolean {
  const item = allItems.get(itemId);
  if (!item) return false;
  const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
  return rarityOrder.indexOf(item.rarity) >= rarityOrder.indexOf("rare");
}
