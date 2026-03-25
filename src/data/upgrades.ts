export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** Price in coins. For tiered upgrades, this is a function of current tier. */
  price: number | ((currentTier: number) => number);
  maxTier: number; // 1 = boolean toggle, >1 = tiered
  /** Upgrade ID that must be purchased first, if any. */
  requires?: string;
}

export const upgrades: UpgradeDef[] = [
  {
    id: "auto_sell",
    name: "Auto-Sell Junk",
    emoji: "💰",
    description: "Automatically sells low-value catches into coins on cast. Set a min value threshold.",
    price: 80_000,
    maxTier: 1,
  },
  {
    id: "multi_cast",
    name: "Multi-Cast Engine",
    emoji: "🎣",
    description: "Cast multiple lines per /cast. Tier 1 = ×2, Tier 2 = ×3, up to Tier 5 = ×6.",
    price: (tier: number) => [75_000, 200_000, 450_000, 900_000, 1_800_000][tier] ?? 1_800_000,
    maxTier: 5,
  },
  {
    id: "auto_join_tournament",
    name: "Auto-Join Tournament Pass",
    emoji: "🏆",
    description: "Automatically enters you into events with entry fees when they start.",
    price: 50_000,
    maxTier: 1,
  },
  {
    id: "deep_sea_sonar",
    name: "Deep-Sea Sonar",
    emoji: "📡",
    description: "Whitelist rarities to never auto-sell (e.g. rare+). Requires Auto-Sell.",
    price: 120_000,
    maxTier: 1,
    requires: "auto_sell",
  },
  {
    id: "bait_compressor",
    name: "Bait Compressor",
    emoji: "🗜️",
    description: "Permanent 15% chance to not consume bait when casting.",
    price: 175_000,
    maxTier: 1,
  },
  {
    id: "tackle_box",
    name: "Master's Tackle Box",
    emoji: "🧰",
    description: "Expands max inventory by 10 slots per level.",
    price: (tier: number) => 65_000 * (tier + 1),
    maxTier: 5,
  },
  {
    id: "chum_streamer",
    name: "Chum Streamer",
    emoji: "🐟",
    description: "Every 10th cast gets an automatic luck buff (no consumable needed).",
    price: 130_000,
    maxTier: 1,
  },
  {
    id: "tax_haven",
    name: "Tax Haven License",
    emoji: "🏦",
    description: "Reduces sell/market fees by 25%, increasing raw profit per catch.",
    price: 225_000,
    maxTier: 1,
  },
  {
    id: "high_tension_line",
    name: "High-Tension Line",
    emoji: "🧵",
    description: "+10% luck bonus when fishing for legendary+ fish.",
    price: 275_000,
    maxTier: 1,
  },
];

export const upgradeMap = new Map(upgrades.map((u) => [u.id, u]));
