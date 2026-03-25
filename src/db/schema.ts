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
} from "drizzle-orm/pg-core";

export const botSchema = pgSchema("bot");

export const leveling = botSchema.table("leveling", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  xp: integer("xp").default(0).notNull(),
  levelId: text("level_id"),
});

export type LevelingSelect = typeof leveling.$inferSelect;
export type LevelingInsert = typeof leveling.$inferInsert;

// ── Fishing Economy ──

export const fishingProfile = botSchema.table("fishing_profile", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  coins: integer("coins").default(0).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  sackLevel: integer("sack_level").default(1).notNull(),
  equippedRodId: text("equipped_rod_id").default("splintered_twig"),
  equippedBaitId: text("equipped_bait_id"),
  preferredBaitId: text("preferred_bait_id"),
  equippedPets: text("equipped_pets").array().notNull().default([]),
  totalCatches: integer("total_catches").default(0).notNull(),
  equippedRodDurability: integer("equipped_rod_durability"),
  equippedTitle: text("equipped_title"),
  leaderboardHidden: boolean("leaderboard_hidden").default(false).notNull(),
  hutOwned: boolean("hut_owned").default(false).notNull(),
  // Streak
  currentStreak: integer("current_streak").default(0).notNull(),
  lastFishDate: date("last_fish_date"),
  // Settings
  hutNotifications: boolean("hut_notifications").default(true).notNull(),
  catchAlerts: boolean("catch_alerts").default(false).notNull(),
  marketAlerts: boolean("market_alerts").default(false).notNull(),
  language: text("language").default("en").notNull(),
  gems: integer("gems").default(0).notNull(),
  reputation: integer("reputation").default(0).notNull(),
  prestigeLevel: integer("prestige_level").default(0).notNull(),
  prestigedAt: timestamp("prestiged_at", { withTimezone: true }),
  equippedLocation: text("equipped_location").default("pond").notNull(),
  // Battle Pass
  battlepassTier: integer("battlepass_tier").default(0).notNull(),
  battlepassXp: integer("battlepass_xp").default(0).notNull(),
  battlepassPremium: boolean("battlepass_premium").default(false).notNull(),
  battlepassSeason: integer("battlepass_season").default(0).notNull(),
  battlepassClaimed: json("battlepass_claimed").$type<number[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type FishingProfileSelect = typeof fishingProfile.$inferSelect;
export type FishingProfileInsert = typeof fishingProfile.$inferInsert;

export const fishingInventory = botSchema.table(
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

export const hut = botSchema.table("hut", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  rodId: text("rod_id"),
  rodDurability: integer("rod_durability"),
  level: integer("level").default(1).notNull(),
  speedLevel: integer("speed_level").default(1).notNull(),
  luckLevel: integer("luck_level").default(1).notNull(),
  inventoryLevel: integer("inventory_level").default(1).notNull(),
  petId: text("pet_id"),
  autoCollect: boolean("auto_collect").default(false).notNull(),
  lastCollectedAt: timestamp("last_collected_at", {
    withTimezone: true,
  }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type HutSelect = typeof hut.$inferSelect;
export type HutInsert = typeof hut.$inferInsert;

export const hutInventory = botSchema.table(
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

export const petInstance = botSchema.table("pet_instance", {
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

export const marketListing = botSchema.table("market_listing", {
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

export const hutNotifications = botSchema.table("hut_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  message: text("message").notNull(), // JSON: { name, emoji, quantity }[]
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  read: boolean("read").default(false).notNull(),
});

export type HutNotificationSelect = typeof hutNotifications.$inferSelect;
export type HutNotificationInsert = typeof hutNotifications.$inferInsert;

export const eggIncubator = botSchema.table("egg_incubator", {
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

export const guildSettings = botSchema.table("guild_settings", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").unique().notNull(),
  eventNotificationChannelId: text("event_notification_channel_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type EggIncubatorSelect = typeof eggIncubator.$inferSelect;
export type EggIncubatorInsert = typeof eggIncubator.$inferInsert;

export const fishingLog = botSchema.table("fishing_log", {
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

export const achievement = botSchema.table(
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

export const playerQuest = botSchema.table("player_quest", {
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

export const tradeLog = botSchema.table("trade_log", {
  id: text("id").primaryKey(),
  initiatorId: text("initiator_id").notNull(),
  targetId: text("target_id").notNull(),
  initiatorItems: json("initiator_items").notNull(), // [{itemId, itemType, qty}]
  targetItems: json("target_items").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const lotteryTicket = botSchema.table("lottery_ticket", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  ticketCount: integer("ticket_count").default(1).notNull(),
  drawId: text("draw_id").notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("lt_draw_user_idx").on(t.drawId, t.userId),
]);

export const lotteryDraw = botSchema.table("lottery_draw", {
  id: text("id").primaryKey(),
  totalPot: integer("total_pot").default(0).notNull(),
  totalTickets: integer("total_tickets").default(0).notNull(),
  winnerId: text("winner_id"),
  status: text("status").default("active").notNull(), // "active" | "completed"
  drawAt: timestamp("draw_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bounty = botSchema.table("bounty", {
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

// ── Player Upgrades ──

export const playerUpgrades = botSchema.table("player_upgrades", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  autoSellEnabled: boolean("auto_sell_enabled").default(false).notNull(),
  autoSellMinValue: integer("auto_sell_min_value").default(100).notNull(),
  multiCastTier: integer("multi_cast_tier").default(0).notNull(), // 0=disabled, 1-5
  autoJoinTournament: boolean("auto_join_tournament").default(false).notNull(),
  deepSeaSonarRarities: json("deep_sea_sonar_rarities").$type<string[]>().default([]),
  baitCompressor: boolean("bait_compressor").default(false).notNull(),
  tackleBoxLevel: integer("tackle_box_level").default(0).notNull(), // 0-5
  chumStreamer: boolean("chum_streamer").default(false).notNull(),
  taxHavenLicense: boolean("tax_haven_license").default(false).notNull(),
  highTensionLine: boolean("high_tension_line").default(false).notNull(),
  castCount: integer("cast_count").default(0).notNull(), // for chum streamer tracking
});

export type PlayerUpgradesSelect = typeof playerUpgrades.$inferSelect;
export type PlayerUpgradesInsert = typeof playerUpgrades.$inferInsert;

// ── Aquarium ──

export const aquarium = botSchema.table("aquarium", {
  id: text("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  maxSlots: integer("max_slots").default(12).notNull(),
  lastCollectedAt: timestamp("last_collected_at", { withTimezone: true }).defaultNow(),
});

export type AquariumSelect = typeof aquarium.$inferSelect;

export const aquariumFish = botSchema.table("aquarium_fish", {
  id: text("id").primaryKey(),
  aquariumId: text("aquarium_id").notNull(),
  fishId: text("fish_id").notNull(),
  placedAt: timestamp("placed_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("af_aquarium_idx").on(t.aquariumId),
]);

// ── Moderation ──

export const userBan = botSchema.table("user_ban", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // "ban" | "timeout"
  reason: text("reason"),
  issuedBy: text("issued_by").notNull(),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null = permanent
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("ub_user_active_idx").on(t.userId, t.active),
]);

export type UserBanSelect = typeof userBan.$inferSelect;
export type UserBanInsert = typeof userBan.$inferInsert;

export const userReport = botSchema.table("user_report", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  evidence: text("evidence"),
  status: text("status").default("open").notNull(), // "open" | "reviewed" | "dismissed"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("ur_target_idx").on(t.targetId),
  index("ur_reporter_target_idx").on(t.reporterId, t.targetId),
]);

export type UserReportSelect = typeof userReport.$inferSelect;
export type UserReportInsert = typeof userReport.$inferInsert;
