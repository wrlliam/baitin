import type { GameEvent } from "./types";

export const events: GameEvent[] = [
  {
    id: "feeding_frenzy",
    name: "Feeding Frenzy",
    description: "Fish are biting like crazy! Catch rates and XP are boosted.",
    effects: [
      { type: "catch_rate", value: 1.5 },
      { type: "xp_multiplier", value: 2.0 },
    ],
    schedule: "random",
    duration: 30 * 60 * 1000, // 30 minutes
  },
  {
    id: "toxic_spill",
    name: "Toxic Spill",
    description: "Pollution has tainted the waters. More junk, but rare mutant fish appear.",
    effects: [
      { type: "rarity_boost", value: 1.5 },
      { type: "catch_rate", value: 0.8 },
    ],
    schedule: "random",
    duration: 20 * 60 * 1000, // 20 minutes
  },
  {
    id: "kings_tournament",
    name: "King's Tournament",
    description: "A royal fishing tournament! Coin rewards are doubled.",
    effects: [
      { type: "coin_multiplier", value: 2.0 },
      { type: "xp_multiplier", value: 1.5 },
    ],
    schedule: "random",
    duration: 60 * 60 * 1000, // 1 hour
    entryFee: 100,
  },
  {
    id: "midnight_tide",
    name: "Midnight Tide",
    description: "Strange creatures emerge under the moonlight. Rarity is massively boosted.",
    effects: [
      { type: "rarity_boost", value: 2.5 },
      { type: "xp_multiplier", value: 1.25 },
    ],
    schedule: "random",
    duration: 45 * 60 * 1000, // 45 minutes
  },
  {
    id: "merchant_shipwreck",
    name: "Merchant Shipwreck",
    description: "A merchant ship sank nearby! The waters are full of treasures.",
    effects: [
      { type: "coin_multiplier", value: 3.0 },
      { type: "catch_rate", value: 1.2 },
    ],
    schedule: "random",
    duration: 15 * 60 * 1000, // 15 minutes
  },
];
