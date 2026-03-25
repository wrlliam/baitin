import type { Fish } from "./types";

export interface LocationEffect {
  type: "catch_rate" | "rarity_boost" | "coin_multiplier" | "xp_multiplier";
  value: number;
}

export interface FishingLocation {
  id: string;
  name: string;
  emoji: string;
  description: string;
  minLevel: number;
  effects: LocationEffect[];
  exclusiveFish: Fish[];
}

// ── Exclusive fish per location ──

const oceanExclusiveFish: Fish[] = [
  {
    id: "giant_tuna",
    name: "Giant Tuna",
    description: "A massive ocean predator that takes incredible strength to reel in.",
    price: 320,
    category: "fish",
    rarity: "uncommon",
    emoji: "🐟",
    weight: 800,
    xp: 12,
    pros: ["Great value for uncommon", "Ocean exclusive"],
    cons: ["Only found in the ocean"],
  },
  {
    id: "manta_ray",
    name: "Manta Ray",
    description: "A graceful sea giant gliding through the deep blue.",
    price: 2800,
    category: "fish",
    rarity: "epic",
    emoji: "🦈",
    weight: 40,
    xp: 45,
    pros: ["Epic ocean exclusive", "High value"],
    cons: ["Very rare"],
  },
];

const deepSeaExclusiveFish: Fish[] = [
  {
    id: "lantern_jellyfish",
    name: "Lantern Jellyfish",
    description: "A bioluminescent deep-sea creature that glows in the dark.",
    price: 650,
    category: "fish",
    rarity: "rare",
    emoji: "🪼",
    weight: 120,
    xp: 22,
    pros: ["Beautiful glow", "Deep sea exclusive"],
    cons: ["Fragile"],
  },
  {
    id: "abyssal_kraken",
    name: "Abyssal Kraken",
    description: "A mythical tentacled beast from the deepest ocean trenches.",
    price: 50000,
    category: "fish",
    rarity: "mythic",
    emoji: "🐙",
    weight: 2,
    xp: 200,
    pros: ["Mythic deep sea exclusive", "Insane value"],
    cons: ["Almost impossible to catch"],
  },
];

const caveExclusiveFish: Fish[] = [
  {
    id: "crystal_anglerfish",
    name: "Crystal Anglerfish",
    description: "A cave-dwelling fish with crystalline fins that refract light.",
    price: 3500,
    category: "fish",
    rarity: "epic",
    emoji: "🔮",
    weight: 35,
    xp: 50,
    pros: ["Stunning appearance", "Cave exclusive"],
    cons: ["Only in the darkest caves"],
  },
  {
    id: "shadow_eel",
    name: "Shadow Eel",
    description: "A serpentine creature that seems to absorb light itself.",
    price: 12000,
    category: "fish",
    rarity: "legendary",
    emoji: "🌑",
    weight: 8,
    xp: 120,
    pros: ["Legendary cave exclusive", "Extremely valuable"],
    cons: ["Elusive and dangerous"],
  },
];

// ── Location definitions ──

export const fishingLocations: FishingLocation[] = [
  {
    id: "pond",
    name: "Pond",
    emoji: "🏞️",
    description: "A calm, shallow pond teeming with common freshwater fish. Perfect for beginners.",
    minLevel: 1,
    effects: [{ type: "catch_rate", value: 1.2 }],
    exclusiveFish: [],
  },
  {
    id: "river",
    name: "River",
    emoji: "🏔️",
    description: "A flowing river with a balanced mix of species. The standard fishing experience.",
    minLevel: 5,
    effects: [],
    exclusiveFish: [],
  },
  {
    id: "ocean",
    name: "Ocean",
    emoji: "🌊",
    description: "The vast open sea. Fewer common fish, but better chances at rare catches.",
    minLevel: 15,
    effects: [{ type: "rarity_boost", value: 1.1 }],
    exclusiveFish: oceanExclusiveFish,
  },
  {
    id: "deep_sea",
    name: "Deep Sea",
    emoji: "🌑",
    description: "The crushing depths where legends lurk. High risk, high reward.",
    minLevel: 30,
    effects: [
      { type: "rarity_boost", value: 1.3 },
      { type: "catch_rate", value: 0.8 },
    ],
    exclusiveFish: deepSeaExclusiveFish,
  },
  {
    id: "cave",
    name: "Cave",
    emoji: "🦇",
    description: "A hidden underground cave system. The rarest fish dwell in absolute darkness.",
    minLevel: 50,
    effects: [
      { type: "rarity_boost", value: 1.5 },
      { type: "catch_rate", value: 0.6 },
      { type: "xp_multiplier", value: 1.25 },
    ],
    exclusiveFish: caveExclusiveFish,
  },
];

export const locationMap = new Map(fishingLocations.map((l) => [l.id, l]));

/** All exclusive fish across all locations, for registration in the item index */
export const allExclusiveFish: Fish[] = fishingLocations.flatMap((l) => l.exclusiveFish);
