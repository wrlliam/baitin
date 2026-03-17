import {
  text,
  boolean,
  json,
  date,
  pgSchema,
  timestamp,
  integer,
  unique,
  pgTable,
} from "drizzle-orm/pg-core";

export const leveling = pgTable("leveling", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  xp: integer("xp").default(0).notNull(),
  levelId: text("level_id"),
});

export type LevelingSelect = typeof leveling.$inferSelect;
export type LevelingInsert = typeof leveling.$inferInsert;

// ── Fishing Economy ──

export const fishingProfile = pgTable("fishing_profile", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  coins: integer("coins").default(0).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  sackLevel: integer("sack_level").default(1).notNull(),
  equippedRodId: text("equipped_rod_id").default("splintered_twig"),
  equippedBaitId: text("equipped_bait_id"),
  equippedPets: text("equipped_pets").array().notNull().default([]),
  totalCatches: integer("total_catches").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type FishingProfileSelect = typeof fishingProfile.$inferSelect;
export type FishingProfileInsert = typeof fishingProfile.$inferInsert;

export const fishingInventory = pgTable(
  "fishing_inventory",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    itemId: text("item_id").notNull(),
    itemType: text("item_type").notNull(),
    quantity: integer("quantity").default(1).notNull(),
  },
  (t) => [unique("fishing_inv_user_item").on(t.userId, t.itemId)],
);

export type FishingInventorySelect = typeof fishingInventory.$inferSelect;
export type FishingInventoryInsert = typeof fishingInventory.$inferInsert;

export const hut = pgTable("hut", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  rodId: text("rod_id"),
  level: integer("level").default(1).notNull(),
  speedLevel: integer("speed_level").default(1).notNull(),
  luckLevel: integer("luck_level").default(1).notNull(),
  inventoryLevel: integer("inventory_level").default(1).notNull(),
  petId: text("pet_id"),
  lastCollectedAt: timestamp("last_collected_at", {
    withTimezone: true,
  }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type HutSelect = typeof hut.$inferSelect;
export type HutInsert = typeof hut.$inferInsert;

export const hutInventory = pgTable(
  "hut_inventory",
  {
    id: text("id").primaryKey(),
    hutId: text("hut_id").notNull(),
    itemId: text("item_id").notNull(),
    itemType: text("item_type").notNull(),
    quantity: integer("quantity").default(1).notNull(),
  },
  (t) => [unique("hut_inv_hut_item").on(t.hutId, t.itemId)],
);

export type HutInventorySelect = typeof hutInventory.$inferSelect;
export type HutInventoryInsert = typeof hutInventory.$inferInsert;

export const petInstance = pgTable("pet_instance", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  petId: text("pet_id").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type PetInstanceSelect = typeof petInstance.$inferSelect;
export type PetInstanceInsert = typeof petInstance.$inferInsert;

export const marketListing = pgTable("market_listing", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id").notNull(),
  itemId: text("item_id").notNull(),
  itemType: text("item_type").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  pricePerUnit: integer("price_per_unit").notNull(),
  isAuction: boolean("is_auction").default(false),
  auctionEndAt: timestamp("auction_end_at", { withTimezone: true }),
  highestBidderId: text("highest_bidder_id"),
  highestBid: integer("highest_bid").default(0),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type MarketListingSelect = typeof marketListing.$inferSelect;
export type MarketListingInsert = typeof marketListing.$inferInsert;

export const fishingLog = pgTable("fishing_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  itemId: text("item_id").notNull(),
  itemType: text("item_type").notNull(),
  caughtAt: timestamp("caught_at", { withTimezone: true }).defaultNow(),
});

export type FishingLogSelect = typeof fishingLog.$inferSelect;
export type FishingLogInsert = typeof fishingLog.$inferInsert;
