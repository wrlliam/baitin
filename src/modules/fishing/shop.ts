import config from "@/config";
import { redis } from "@/db/redis";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { baits, rods, eggs, potions, rodItems } from "@/data";
import { getOrCreateProfile, subtractCoins, addCoins } from "./economy";
import { addItem } from "./inventory";
import { getBuffTotal } from "./buffs";
import { getRepPerks } from "./reputation";
import type { BaseItem, Rod } from "@/data/types";

export const SHOP_CATEGORIES = ["bait", "rod", "potion", "egg", "special"] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  bait: `${config.emojis.bait} Bait`,
  rod: `${config.emojis.rod} Rods`,
  potion: "⚗️ Potions",
  egg: `${config.emojis.egg} Eggs`,
  special: `${config.emojis.star} Special`,
};

export interface ShopEntry {
  item: BaseItem;
  buyPrice: number;
  stock: number; // -1 = unlimited
}

// Items in the special category (piggyback on Potion shape)
const SPECIAL_BUY_PRICES: Record<string, number> = {
  rod_repair_kit: 6000,
  hut_permit: 150000,
};

function getDailyStockKey(itemId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `shop:stock:${itemId}:${date}`;
}

function getTTLToMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

function getDefaultDailyStock(itemId: string): number {
  if (baits.find((b) => b.id === itemId)) return -1;
  if (rods.find((r) => r.id === itemId)) return 5;
  if (eggs.find((e) => e.id === itemId)) return 10;
  const potion = potions.find((p) => p.id === itemId);
  if (potion) return potion.rarity === "common" ? -1 : 10;
  if (itemId === "rod_repair_kit") return 10;
  return -1;
}

export async function getItemStock(itemId: string): Promise<number> {
  if (itemId === "hut_permit") {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fishingProfile)
      .where(eq(fishingProfile.hutOwned, true));
    const used = Number(rows[0]?.count ?? 0);
    return Math.max(0, 10 - used);
  }

  const defaultStock = getDefaultDailyStock(itemId);
  if (defaultStock === -1) return -1;

  const key = getDailyStockKey(itemId);
  const val = await redis.get(key);
  if (val === null) return defaultStock;
  return parseInt(val);
}

async function batchGetStocks(itemIds: string[]): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  const redisItems: { itemId: string; key: string; defaultStock: number }[] = [];

  for (const itemId of itemIds) {
    if (itemId === "hut_permit") {
      // hut_permit uses a DB query, not Redis
      stockMap.set(itemId, await getItemStock(itemId));
      continue;
    }
    const defaultStock = getDefaultDailyStock(itemId);
    if (defaultStock === -1) {
      stockMap.set(itemId, -1);
    } else {
      redisItems.push({ itemId, key: getDailyStockKey(itemId), defaultStock });
    }
  }

  if (redisItems.length > 0) {
    const keys = redisItems.map((r) => r.key);
    const values = await redis.send("MGET", keys) as (string | null)[];
    for (let i = 0; i < redisItems.length; i++) {
      const val = values[i];
      stockMap.set(redisItems[i].itemId, val === null ? redisItems[i].defaultStock : parseInt(val));
    }
  }

  return stockMap;
}

export async function getShopCategory(category: ShopCategory): Promise<ShopEntry[]> {
  const entries: ShopEntry[] = [];

  if (category === "bait") {
    for (const b of baits) {
      entries.push({ item: b, buyPrice: b.buyPrice, stock: -1 });
    }
  } else if (category === "rod") {
    const filteredRods = rods.filter((r) => r.buyPrice > 0);
    const stocks = await batchGetStocks(filteredRods.map((r) => r.id));
    for (const r of filteredRods) {
      entries.push({ item: r, buyPrice: r.buyPrice, stock: stocks.get(r.id) ?? -1 });
    }
  } else if (category === "potion") {
    const filteredPotions = potions.filter((p) => p.id !== "rod_repair_kit" && p.id !== "hut_permit");
    const stocks = await batchGetStocks(filteredPotions.map((p) => p.id));
    for (const p of filteredPotions) {
      entries.push({ item: p, buyPrice: p.price, stock: stocks.get(p.id) ?? -1 });
    }
  } else if (category === "egg") {
    const stocks = await batchGetStocks(eggs.map((e) => e.id));
    for (const e of eggs) {
      entries.push({ item: e, buyPrice: e.price, stock: stocks.get(e.id) ?? -1 });
    }
  } else if (category === "special") {
    const specialItems = potions.filter((p) => p.id === "rod_repair_kit" || p.id === "hut_permit");
    const stocks = await batchGetStocks(specialItems.map((s) => s.id));
    for (const s of specialItems) {
      const stock = stocks.get(s.id) ?? -1;
      const buyPrice = SPECIAL_BUY_PRICES[s.id] ?? s.price;

      // Hut permit: only show if stock > 0 AND random 30% chance (rare appearance)
      if (s.id === "hut_permit") {
        if (stock > 0 && Math.random() < 0.3) {
          entries.push({ item: s, buyPrice, stock });
        }
        continue;
      }

      entries.push({ item: s, buyPrice, stock });
    }
  }

  return entries;
}

export async function buyShopItem(
  userId: string,
  itemId: string
): Promise<{ success: boolean; error?: string; item?: BaseItem; price?: number }> {
  // Find item and price
  const bait = baits.find((b) => b.id === itemId);
  const rod = rods.find((r) => r.id === itemId);
  const egg = eggs.find((e) => e.id === itemId);
  const potion = potions.find((p) => p.id === itemId);

  let item: BaseItem | undefined;
  let price = 0;

  if (bait) { item = bait; price = bait.buyPrice; }
  else if (rod) { item = rod; price = rod.buyPrice; }
  else if (egg) { item = egg; price = egg.price; }
  else if (potion) {
    item = potion;
    price = SPECIAL_BUY_PRICES[itemId] ?? potion.price;
  }

  if (!item) return { success: false, error: "Item not found in shop." };

  // Check stock (unlimited items skip stock check)
  const defaultStock = getDefaultDailyStock(itemId);
  const isLimited = defaultStock !== -1 && itemId !== "hut_permit";

  if (isLimited) {
    // Atomic decrement to prevent TOCTOU race
    const key = getDailyStockKey(itemId);
    const ttl = getTTLToMidnight();

    // Initialize stock in Redis if not set yet
    const exists = await redis.get(key);
    if (exists === null) {
      await redis.send("SETEX", [key, ttl.toString(), defaultStock.toString()]);
    }

    const newStock = Number(await redis.send("DECR", [key]));
    if (newStock < 0) {
      await redis.send("INCR", [key]); // Rollback
      return { success: false, error: "This item is sold out!" };
    }
  } else if (itemId !== "hut_permit") {
    // Unlimited stock — no check needed
  } else {
    // hut_permit uses DB-based stock
    const stock = await getItemStock(itemId);
    if (stock === 0) return { success: false, error: "This item is sold out!" };
  }

  // Apply cost reduction buff
  const costReduction = await getBuffTotal(userId, "cost_reduction");
  if (costReduction > 0) {
    price = Math.max(1, Math.floor(price * (1 - costReduction)));
  }

  // Rep perk: -5% shop prices at 10+ rep
  const profile = await getOrCreateProfile(userId);
  const repPerks = getRepPerks(profile.reputation);
  if (repPerks.shopDiscount > 0) {
    price = Math.max(1, Math.floor(price * (1 - repPerks.shopDiscount)));
  }

  // Special handling for hut_permit
  if (itemId === "hut_permit") {
    const profile = await getOrCreateProfile(userId);
    if (profile.hutOwned) {
      return { success: false, error: "You already own a hut permit!" };
    }

    const paid = await subtractCoins(userId, price);
    if (!paid) return { success: false, error: "Not enough coins." };

    await db
      .update(fishingProfile)
      .set({ hutOwned: true })
      .where(eq(fishingProfile.userId, userId));

    return { success: true, item, price };
  }

  // ── Rod auto-replace: equip directly, don't add to inventory ──
  if (rod) {
    const profile = await getOrCreateProfile(userId);
    const currentRod = rodItems.get(profile.equippedRodId ?? "splintered_twig");
    const currentBuyPrice = currentRod ? (currentRod as Rod).buyPrice : 0;

    if (rod.buyPrice <= currentBuyPrice) {
      // Rollback stock
      if (isLimited) {
        const key = getDailyStockKey(itemId);
        await redis.send("INCR", [key]);
      }
      return { success: false, error: `You already have a better rod equipped! (${currentRod?.name ?? "Splintered Twig"})` };
    }

    const paid = await subtractCoins(userId, price);
    if (!paid) {
      if (isLimited) {
        const key = getDailyStockKey(itemId);
        await redis.send("INCR", [key]);
      }
      return { success: false, error: "Not enough coins." };
    }

    // Equip the new rod directly on the profile
    await db
      .update(fishingProfile)
      .set({ equippedRodId: rod.id, equippedRodDurability: rod.durability > 0 ? rod.durability : null })
      .where(eq(fishingProfile.userId, userId));

    return { success: true, item, price };
  }

  // Deduct coins
  const paid = await subtractCoins(userId, price);
  if (!paid) {
    // Rollback stock decrement if coins insufficient
    if (isLimited) {
      const key = getDailyStockKey(itemId);
      await redis.send("INCR", [key]);
    }
    return { success: false, error: "Not enough coins." };
  }

  // Add to inventory
  const added = await addItem(userId, itemId, item.category, 1);
  if (!added) {
    await addCoins(userId, price);
    // Rollback stock decrement if inventory full
    if (isLimited) {
      const key = getDailyStockKey(itemId);
      await redis.send("INCR", [key]);
    }
    return { success: false, error: "Your sack is full! Upgrade or sell items." };
  }

  return { success: true, item, price };
}
