import {
  text,
  boolean,
  json,
  date,
  pgSchema,
  timestamp,
  integer,
  unique,
  uniqueIndex,
  index,
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
  equippedRodDurability: integer("equipped_rod_durability"),
  leaderboardHidden: boolean("leaderboard_hidden").default(false).notNull(),
  hutOwned: boolean("hut_owned").default(false).notNull(),
  // Streak
  currentStreak: integer("current_streak").default(0).notNull(),
  lastFishDate: date("last_fish_date"),
  // Settings
  hutNotifications: boolean("hut_notifications").default(true).notNull(),
  gems: integer("gems").default(0).notNull(),
  reputation: integer("reputation").default(0).notNull(),
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
  (t) => [
    unique("fishing_inv_user_item").on(t.userId, t.itemId),
    index("fi_user_idx").on(t.userId),
  ],
);

export type FishingInventorySelect = typeof fishingInventory.$inferSelect;
export type FishingInventoryInsert = typeof fishingInventory.$inferInsert;

export const hut = pgTable("hut", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  rodId: text("rod_id"),
  rodDurability: integer("rod_durability"),
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
  petLevel: integer("pet_level").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("pi_user_idx").on(t.userId),
]);

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
}, (t) => [
  index("ml_status_created_idx").on(t.status, t.createdAt),
]);

export type MarketListingSelect = typeof marketListing.$inferSelect;
export type MarketListingInsert = typeof marketListing.$inferInsert;

export const hutNotifications = pgTable("hut_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  message: text("message").notNull(), // JSON: { name, emoji, quantity }[]
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  read: boolean("read").default(false).notNull(),
});

export type HutNotificationSelect = typeof hutNotifications.$inferSelect;
export type HutNotificationInsert = typeof hutNotifications.$inferInsert;

export const eggIncubator = pgTable("egg_incubator", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  eggId: text("egg_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  hatchesAt: timestamp("hatches_at", { withTimezone: true }).notNull(),
  hatched: boolean("hatched").default(false).notNull(),
  failed: boolean("failed").default(false).notNull(),
}, (t) => [
  index("ei_user_hatched_idx").on(t.userId, t.hatched),
]);

export const guildSettings = pgTable("guild_settings", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").unique().notNull(),
  eventNotificationChannelId: text("event_notification_channel_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type EggIncubatorSelect = typeof eggIncubator.$inferSelect;
export type EggIncubatorInsert = typeof eggIncubator.$inferInsert;

export const fishingLog = pgTable("fishing_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  itemId: text("item_id").notNull(),
  itemType: text("item_type").notNull(),
  caughtAt: timestamp("caught_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("fl_user_type_idx").on(t.userId, t.itemType),
]);

export type FishingLogSelect = typeof fishingLog.$inferSelect;
export type FishingLogInsert = typeof fishingLog.$inferInsert;

export const achievement = pgTable(
  "achievement",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique("ach_user_ach").on(t.userId, t.achievementId),
    index("ach_user_idx").on(t.userId),
  ],
);

export type AchievementSelect = typeof achievement.$inferSelect;
export type AchievementInsert = typeof achievement.$inferInsert;

export const playerQuest = pgTable("player_quest", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  questId: text("quest_id").notNull(),
  type: text("type").notNull(), // "daily" | "weekly"
  progress: integer("progress").default(0).notNull(),
  goal: integer("goal").notNull(),
  completed: boolean("completed").default(false).notNull(),
  claimed: boolean("claimed").default(false).notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  index("pq_user_type_idx").on(t.userId, t.type),
]);

export type PlayerQuestSelect = typeof playerQuest.$inferSelect;
export type PlayerQuestInsert = typeof playerQuest.$inferInsert;

// ── Social & PvP ──

export const tradeLog = pgTable("trade_log", {
  id: text("id").primaryKey(),
  initiatorId: text("initiator_id").notNull(),
  targetId: text("target_id").notNull(),
  initiatorItems: json("initiator_items").notNull(), // [{itemId, itemType, qty}]
  targetItems: json("target_items").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lotteryTicket = pgTable("lottery_ticket", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  ticketCount: integer("ticket_count").default(1).notNull(),
  drawId: text("draw_id").notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("lt_draw_user_idx").on(t.drawId, t.userId),
]);

export const lotteryDraw = pgTable("lottery_draw", {
  id: text("id").primaryKey(),
  totalPot: integer("total_pot").default(0).notNull(),
  totalTickets: integer("total_tickets").default(0).notNull(),
  winnerId: text("winner_id"),
  status: text("status").default("active").notNull(), // "active" | "completed"
  drawAt: timestamp("draw_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bounty = pgTable("bounty", {
  id: text("id").primaryKey(),
  placerId: text("placer_id").notNull(),
  targetId: text("target_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").default("active").notNull(), // "active" | "claimed" | "expired"
  claimedBy: text("claimed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  index("bounty_target_status_idx").on(t.targetId, t.status),
]);
