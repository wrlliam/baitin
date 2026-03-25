export interface TitleDef {
  id: string;
  name: string;
  emoji: string;
  source: "achievement" | "level" | "reputation" | "collection" | "prestige";
  /** For achievement-based titles, the achievement ID that unlocks it */
  achievementId?: string;
  /** For level-based titles, the minimum level */
  minLevel?: number;
  /** For reputation-based titles, the minimum rep */
  minRep?: number;
  /** For collection-based titles, the collection milestone achievement ID */
  collectionAchievementId?: string;
  /** For prestige-based titles, the minimum prestige level */
  minPrestige?: number;
}

export const titles: TitleDef[] = [
  // ── Level milestones ──────────────────────────────────────────────────────
  { id: "novice_fisher", name: "Novice Fisher", emoji: "🐟", source: "level", minLevel: 5 },
  { id: "apprentice_angler", name: "Apprentice Angler", emoji: "🎣", source: "level", minLevel: 10 },
  { id: "skilled_caster", name: "Skilled Caster", emoji: "🌊", source: "level", minLevel: 15 },
  { id: "expert_fisher", name: "Expert Fisher", emoji: "⚡", source: "level", minLevel: 20 },
  { id: "master_angler", name: "Master Angler", emoji: "👑", source: "level", minLevel: 25 },
  { id: "grandmaster_fisher", name: "Grandmaster Fisher", emoji: "🏆", source: "level", minLevel: 30 },
  { id: "legendary_angler", name: "Legendary Angler", emoji: "✨", source: "level", minLevel: 40 },
  { id: "mythic_fisher", name: "Mythic Fisher", emoji: "🔱", source: "level", minLevel: 50 },
  { id: "deep_sea_legend", name: "Deep Sea Legend", emoji: "🌟", source: "level", minLevel: 75 },
  { id: "ocean_god", name: "Ocean God", emoji: "🌊", source: "level", minLevel: 100 },

  // ── Achievement-based ─────────────────────────────────────────────────────
  { id: "junk_lover", name: "Junk Lover", emoji: "🗑️", source: "achievement", achievementId: "junk_hoarder" },
  { id: "rod_breaker", name: "Rod Breaker", emoji: "💥", source: "achievement", achievementId: "rod_broke" },
  { id: "myth_hunter", name: "Myth Hunter", emoji: "✦", source: "achievement", achievementId: "first_mythic" },
  { id: "century_angler", name: "Century Angler", emoji: "💯", source: "achievement", achievementId: "catches_100" },
  { id: "streak_master", name: "Streak Master", emoji: "🔥", source: "achievement", achievementId: "streak_30" },

  // ── Collection milestones ─────────────────────────────────────────────────
  { id: "naturalist", name: "Naturalist", emoji: "📘", source: "collection", collectionAchievementId: "collector_50" },
  { id: "encyclopedist", name: "Encyclopedist", emoji: "📕", source: "collection", collectionAchievementId: "collector_100" },

  // ── Reputation ────────────────────────────────────────────────────────────
  { id: "beloved", name: "Beloved", emoji: "💕", source: "reputation", minRep: 250 },

  // ── Gem Shop ───────────────────────────────────────────────────────────────
  { id: "diamond_angler", name: "Diamond Angler", emoji: "💎", source: "achievement", achievementId: "__gem_shop_diamond_angler" },
  { id: "gem_hoarder", name: "Gem Hoarder", emoji: "💰", source: "achievement", achievementId: "__gem_shop_gem_hoarder" },

  // ── Prestige ──────────────────────────────────────────────────────────────
  { id: "prestige_1", name: "Prestige I", emoji: "⭐", source: "prestige", minPrestige: 1 },
  { id: "prestige_2", name: "Prestige II", emoji: "⭐⭐", source: "prestige", minPrestige: 2 },
  { id: "prestige_3", name: "Prestige III", emoji: "🌟", source: "prestige", minPrestige: 3 },
  { id: "prestige_5", name: "Prestige V", emoji: "🌟🌟", source: "prestige", minPrestige: 5 },
  { id: "prestige_10", name: "Prestige X", emoji: "💎", source: "prestige", minPrestige: 10 },
];

export const titleMap = new Map(titles.map((t) => [t.id, t]));
