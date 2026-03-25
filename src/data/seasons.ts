import type { WeatherEffect } from "./weather";

export interface Season {
  month: number; // 0-11
  name: string;
  emoji: string;
  description: string;
  effects: WeatherEffect[];
}

export const seasons: Season[] = [
  {
    month: 0, name: "Ice Fishing", emoji: "🧊",
    description: "Frozen waters yield icy treasures. +20% catch rate.",
    effects: [{ type: "catch_rate", value: 1.2 }],
  },
  {
    month: 1, name: "Love Tides", emoji: "💕",
    description: "Romance fills the seas. 2× coin bonus.",
    effects: [{ type: "coin_multiplier", value: 2.0 }],
  },
  {
    month: 2, name: "Spring Bloom", emoji: "🌸",
    description: "New life blooms underwater. +30% XP.",
    effects: [{ type: "xp_multiplier", value: 1.3 }],
  },
  {
    month: 3, name: "Fool's Tide", emoji: "🃏",
    description: "Nothing is as it seems. Junk drops surprise items.",
    effects: [{ type: "coin_multiplier", value: 1.2 }],
  },
  {
    month: 4, name: "Deep Current", emoji: "🌀",
    description: "Deep ocean currents stir up rare species. +40% rarity.",
    effects: [{ type: "rarity_boost", value: 1.4 }],
  },
  {
    month: 5, name: "Summer Splash", emoji: "☀️",
    description: "Long sunny days mean more time to fish. Faster cooldowns.",
    effects: [{ type: "catch_rate", value: 1.25 }],
  },
  {
    month: 6, name: "Coral Festival", emoji: "🪸",
    description: "Coral reefs teem with life. All locations feel alive.",
    effects: [
      { type: "catch_rate", value: 1.1 },
      { type: "rarity_boost", value: 1.1 },
    ],
  },
  {
    month: 7, name: "Monsoon", emoji: "🌧️",
    description: "Fierce storms churn the waters. Stormy bonuses always active.",
    effects: [
      { type: "rarity_boost", value: 1.3 },
      { type: "xp_multiplier", value: 1.2 },
    ],
  },
  {
    month: 8, name: "Harvest Tide", emoji: "🍂",
    description: "Autumn bounty fills the seas. Sell prices +30%.",
    effects: [{ type: "coin_multiplier", value: 1.3 }],
  },
  {
    month: 9, name: "Spooky Seas", emoji: "🎃",
    description: "Ghosts and ghouls lurk beneath. 2× mythic chance.",
    effects: [{ type: "rarity_boost", value: 1.5 }],
  },
  {
    month: 10, name: "Migration", emoji: "🦅",
    description: "Fish migrate through all waters. +50% XP.",
    effects: [{ type: "xp_multiplier", value: 1.5 }],
  },
  {
    month: 11, name: "Frost Gala", emoji: "🎄",
    description: "A festive celebration under the ice. Extra rewards everywhere.",
    effects: [
      { type: "coin_multiplier", value: 1.2 },
      { type: "xp_multiplier", value: 1.2 },
    ],
  },
];

export function getCurrentSeason(): Season {
  const month = new Date().getUTCMonth();
  return seasons[month];
}

export function getDaysRemaining(): number {
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 86_400_000);
}
