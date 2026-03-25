export type GemShopCategory = "titles" | "potions" | "utility";

export interface GemShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  gemCost: number;
  category: GemShopCategory;
  /** For title items, the title ID to grant */
  titleId?: string;
  /** For potion/buff items, the buff type and duration */
  buff?: { type: string; amount: number; durationMinutes: number };
  /** For utility items, a special action key */
  action?: string;
}

export const gemShopItems: GemShopItem[] = [
  // ── Titles ────────────────────────────────────────────────────────────────
  {
    id: "gem_title_diamond",
    name: "Diamond Angler",
    emoji: "💎",
    description: "An exclusive cosmetic title.",
    gemCost: 50,
    category: "titles",
    titleId: "diamond_angler",
  },
  {
    id: "gem_title_hoarder",
    name: "Gem Hoarder",
    emoji: "💰",
    description: "Show off your gem wealth.",
    gemCost: 100,
    category: "titles",
    titleId: "gem_hoarder",
  },

  // ── Potions ───────────────────────────────────────────────────────────────
  {
    id: "gem_mega_xp",
    name: "Mega XP Elixir",
    emoji: "📖",
    description: "2× XP for 2 hours.",
    gemCost: 15,
    category: "potions",
    buff: { type: "xp_boost", amount: 1.0, durationMinutes: 120 },
  },
  {
    id: "gem_lucky_star",
    name: "Lucky Star",
    emoji: "🌟",
    description: "3× rarity boost for 30 minutes.",
    gemCost: 20,
    category: "potions",
    buff: { type: "luck_boost", amount: 2.0, durationMinutes: 30 },
  },
  {
    id: "gem_coin_surge",
    name: "Coin Surge",
    emoji: "💸",
    description: "2× coins for 1 hour.",
    gemCost: 12,
    category: "potions",
    buff: { type: "coin_boost", amount: 1.0, durationMinutes: 60 },
  },

  // ── Utility ───────────────────────────────────────────────────────────────
  {
    id: "gem_rod_repair",
    name: "Rod Repair Kit",
    emoji: "🔧",
    description: "Fully restores your equipped rod's durability.",
    gemCost: 5,
    category: "utility",
    action: "rod_repair",
  },
  {
    id: "gem_streak_saver",
    name: "Streak Saver",
    emoji: "🛡️",
    description: "Protects your streak for 1 missed day.",
    gemCost: 8,
    category: "utility",
    action: "streak_saver",
  },
];

export const gemShopMap = new Map(gemShopItems.map((i) => [i.id, i]));

export const GEM_SHOP_CATEGORIES: { id: GemShopCategory; label: string; emoji: string }[] = [
  { id: "titles", label: "Titles", emoji: "🏅" },
  { id: "potions", label: "Potions", emoji: "⚗️" },
  { id: "utility", label: "Utility", emoji: "🔧" },
];
