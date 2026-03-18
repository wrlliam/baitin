import { redis } from "@/db/redis";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { baits, rods, eggs, potions } from "@/data";
import { getOrCreateProfile, subtractCoins, addCoins } from "./economy";
import { addItem } from "./inventory";
import { getBuffTotal } from "./buffs";
import type { BaseItem } from "@/data/types";

export const SHOP_CATEGORIES = ["bait", "rod", "potion", "egg", "special"] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ShopCategory, string> = {
  bait: "🪱 Bait",
  rod: "🎣 Rods",
  potion: "⚗️ Potions",
  egg: "🥚 Eggs",
  special: "🌟 Special",
};

export interface ShopEntry {
  item: BaseItem;
  buyPrice: number;
  stock: number; // -1 = unlimited
}

// Items in the special category (piggyback on Potion shape)
const SPECIAL_BUY_PRICES: Record<string, number> = {
  rod_repair_kit: 2000,
  hut_permit: 50000,
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

export async function getShopCategory(category: ShopCategory): Promise<ShopEntry[]> {
  const entries: ShopEntry[] = [];

  if (category === "bait") {
    for (const b of baits) {
      entries.push({ item: b, buyPrice: b.buyPrice, stock: -1 });
    }
  } else if (category === "rod") {
    for (const r of rods.filter((r) => r.buyPrice > 0)) {
      const stock = await getItemStock(r.id);
      entries.push({ item: r, buyPrice: r.buyPrice, stock });
    }
  } else if (category === "potion") {
    for (const p of potions.filter((p) => p.id !== "rod_repair_kit" && p.id !== "hut_permit")) {
      const stock = await getItemStock(p.id);
      entries.push({ item: p, buyPrice: p.price, stock });
    }
  } else if (category === "egg") {
    for (const e of eggs) {
      const stock = await getItemStock(e.id);
      entries.push({ item: e, buyPrice: e.price, stock });
    }
  } else if (category === "special") {
    const specialItems = potions.filter((p) => p.id === "rod_repair_kit" || p.id === "hut_permit");
    for (const s of specialItems) {
      const stock = await getItemStock(s.id);
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

  // Check stock
  const stock = await getItemStock(itemId);
  if (stock === 0) return { success: false, error: "This item is sold out!" };

  // Apply cost reduction buff
  const costReduction = await getBuffTotal(userId, "cost_reduction");
  if (costReduction > 0) {
    price = Math.max(1, Math.floor(price * (1 - costReduction)));
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

  // Deduct coins
  const paid = await subtractCoins(userId, price);
  if (!paid) return { success: false, error: "Not enough coins." };

  // Add to inventory
  const added = await addItem(userId, itemId, item.category, 1);
  if (!added) {
    await addCoins(userId, price);
    return { success: false, error: "Your sack is full! Upgrade or sell items." };
  }

  // Decrement stock if limited
  if (stock !== -1) {
    const key = getDailyStockKey(itemId);
    const ttl = getTTLToMidnight();
    const newStock = Math.max(0, stock - 1);
    await redis.set(key, newStock.toString());
    await redis.send("EXPIRE", [key, ttl.toString()]);
  }

  return { success: true, item, price };
}
