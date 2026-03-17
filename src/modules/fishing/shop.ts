import { redis } from "@/db/redis";
import { baits, rods, eggs } from "@/data";
import { getOrCreateProfile, subtractCoins } from "./economy";
import { addItem, getItemQuantity } from "./inventory";
import type { BaseItem } from "@/data/types";

interface ShopItem {
  item: BaseItem;
  stock: number;
  price: number;
}

interface DailyShop {
  items: ShopItem[];
  generatedAt: number;
}

export async function getDailyShop(): Promise<DailyShop> {
  const key = "fish:shop:daily";
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as DailyShop;
  }

  const shop = generateDailyShop();
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttl = Math.floor((midnight.getTime() - now.getTime()) / 1000);

  await redis.set(key, JSON.stringify(shop));
  await redis.send("EXPIRE", [key, ttl.toString()]);

  return shop;
}

function generateDailyShop(): DailyShop {
  const items: ShopItem[] = [];

  // Always include all baits
  for (const b of baits) {
    items.push({ item: b, stock: 99, price: b.buyPrice });
  }

  // Random selection of 2-3 rods
  const shuffledRods = [...rods].filter((r) => r.buyPrice > 0).sort(() => Math.random() - 0.5);
  for (const r of shuffledRods.slice(0, 2 + Math.floor(Math.random() * 2))) {
    items.push({ item: r, stock: 3, price: r.buyPrice });
  }

  // All eggs always available
  for (const e of eggs) {
    items.push({ item: e, stock: 10, price: e.price });
  }

  return { items, generatedAt: Date.now() };
}

export async function buyItem(
  userId: string,
  itemId: string,
  quantity: number = 1
): Promise<{ success: boolean; error?: string }> {
  const shop = await getDailyShop();
  const shopItem = shop.items.find((i) => i.item.id === itemId);

  if (!shopItem) return { success: false, error: "Item not found in today's shop." };
  if (shopItem.stock < quantity) return { success: false, error: "Not enough stock." };

  const totalCost = shopItem.price * quantity;
  const paid = await subtractCoins(userId, totalCost);
  if (!paid) return { success: false, error: "Not enough coins." };

  const added = await addItem(userId, itemId, shopItem.item.category, quantity);
  if (!added) return { success: false, error: "Your sack is full! Upgrade or sell items." };

  // Decrease stock in cache
  shopItem.stock -= quantity;
  const key = "fish:shop:daily";
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttl = Math.floor((midnight.getTime() - now.getTime()) / 1000);
  await redis.set(key, JSON.stringify(shop));
  await redis.send("EXPIRE", [key, ttl.toString()]);

  return { success: true };
}
