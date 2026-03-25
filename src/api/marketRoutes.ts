import Elysia from "elysia";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { marketListing } from "@/db/schema";
import { allItems } from "@/data";
import {
  createListing,
  buyListing,
  placeBid,
  cancelListing,
  getListings,
  getListingCount,
} from "@/modules/fishing/market";
import { requireAuth } from "./auth";
import type { Client } from "discord.js";

export function createMarketRoutes(_client: Client) {
  return new Elysia({ prefix: "/market" })

    // ── GET /market ──────────────────────────────────────────────────────────
    .get("/", async ({ query, headers, set }) => {
      const auth = requireAuth(headers.authorization, set);
      if (!auth.ok) return auth;

      const page = Math.max(parseInt(query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(query.limit as string) || 20, 1), 100);
      const type = (query.type as string) || "all";
      const sort = (query.sort as string) || "newest";

      const validTypes = ["fish", "rod", "bait", "misc", "all"];
      if (!validTypes.includes(type)) {
        set.status = 400;
        return { success: false, error: "Invalid type. Use: fish, rod, bait, misc, all" };
      }

      const category = type === "all" ? undefined : type;

      // Fetch with sort applied
      const conditions: ReturnType<typeof eq>[] = [eq(marketListing.status, "active")];
      if (category) conditions.push(eq(marketListing.itemType, category));

      const orderBy =
        sort === "price_asc"
          ? asc(marketListing.pricePerUnit)
          : sort === "price_desc"
            ? desc(marketListing.pricePerUnit)
            : desc(marketListing.createdAt);

      const [rows, total] = await Promise.all([
        db
          .select()
          .from(marketListing)
          .where(and(...conditions))
          .orderBy(orderBy)
          .limit(limit)
          .offset((page - 1) * limit),
        getListingCount({ category, status: "active" }),
      ]);

      const listings = rows.map((row) => {
        const item = allItems.get(row.itemId);
        return {
          id: row.id,
          sellerId: row.sellerId,
          item: {
            id: row.itemId,
            name: item?.name ?? row.itemId,
            emoji: item?.emoji ?? "❓",
            rarity: (item as any)?.rarity ?? "common",
          },
          itemType: row.itemType,
          price: row.pricePerUnit,
          quantity: row.quantity,
          bidding: row.isAuction ?? false,
          highestBid: row.highestBid ?? 0,
          endsAt: row.auctionEndAt?.toISOString() ?? null,
          createdAt: row.createdAt?.toISOString() ?? null,
        };
      });

      return { success: true, data: { total, page, limit, listings } };
    })

    // ── POST /market/list ────────────────────────────────────────────────────
    .post("/list", async ({ headers, body, set }) => {
      const auth = requireAuth(headers.authorization, set);
      if (!auth.ok) return auth;

      const { itemId, itemType, price, quantity, auctionDurationHours } = body as {
        itemId?: string;
        itemType?: string;
        price?: number;
        quantity?: number;
        auctionDurationHours?: number;
      };

      if (!itemId || !itemType || typeof price !== "number" || typeof quantity !== "number") {
        set.status = 400;
        return { success: false, error: "itemId, itemType, price, and quantity are required" };
      }
      if (price < 1 || quantity < 1) {
        set.status = 400;
        return { success: false, error: "price and quantity must be at least 1" };
      }

      const isAuction = typeof auctionDurationHours === "number" && auctionDurationHours > 0;
      const durationMs = isAuction ? auctionDurationHours! * 60 * 60 * 1000 : undefined;

      const result = await createListing(
        auth.userId,
        itemId,
        itemType,
        quantity,
        price,
        isAuction,
        durationMs,
      );

      if (!result.success) {
        set.status = 400;
        return { success: false, error: result.error };
      }

      return { success: true, data: { listingId: result.listingId } };
    })

    // ── POST /market/:listingId/buy ──────────────────────────────────────────
    .post("/:listingId/buy", async ({ params, headers, set }) => {
      const auth = requireAuth(headers.authorization, set);
      if (!auth.ok) return auth;

      // Look up cost before buying so we can return it
      const rows = await db
        .select({ pricePerUnit: marketListing.pricePerUnit, quantity: marketListing.quantity })
        .from(marketListing)
        .where(and(eq(marketListing.id, params.listingId), eq(marketListing.status, "active")));

      if (!rows[0]) {
        set.status = 404;
        return { success: false, error: "Listing not found or no longer active" };
      }

      const costPaid = rows[0].pricePerUnit * rows[0].quantity;
      const result = await buyListing(auth.userId, params.listingId);

      if (!result.success) {
        set.status = 400;
        return { success: false, error: result.error };
      }

      return { success: true, data: { costPaid } };
    })

    // ── POST /market/:listingId/bid ──────────────────────────────────────────
    .post("/:listingId/bid", async ({ params, headers, body, set }) => {
      const auth = requireAuth(headers.authorization, set);
      if (!auth.ok) return auth;

      const { amount } = body as { amount?: number };
      if (typeof amount !== "number" || amount < 1) {
        set.status = 400;
        return { success: false, error: "body.amount must be a positive number" };
      }

      const result = await placeBid(auth.userId, params.listingId, amount);
      if (!result.success) {
        set.status = 400;
        return { success: false, error: result.error };
      }

      return { success: true, data: { newHighestBid: amount } };
    })

    // ── DELETE /market/:listingId ────────────────────────────────────────────
    .delete("/:listingId", async ({ params, headers, set }) => {
      const auth = requireAuth(headers.authorization, set);
      if (!auth.ok) return auth;

      const result = await cancelListing(auth.userId, params.listingId);
      if (!result.success) {
        set.status = 400;
        return { success: false, error: result.error };
      }

      return { success: true };
    });
}
