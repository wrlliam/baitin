import type { Fish } from "./types";

export interface SeasonalFish extends Fish {
  seasonMonth: number; // 0-11 (UTC month)
}

export const seasonalFish: SeasonalFish[] = [
  // January — Ice Fishing
  {
    id: "frost_trout", name: "Frost Trout", description: "A shimmering trout encased in a thin layer of ice crystals.",
    price: 1200, category: "fish", rarity: "rare", emoji: "❄️", weight: 100, xp: 25,
    pros: ["January exclusive", "Beautiful frost pattern"], cons: ["Melts quickly"], seasonMonth: 0,
  },
  {
    id: "glacier_cod", name: "Glacier Cod", description: "An ancient fish preserved in glacial waters for centuries.",
    price: 4500, category: "fish", rarity: "epic", emoji: "🧊", weight: 30, xp: 55,
    pros: ["January exclusive", "Ancient species"], cons: ["Extremely cold to handle"], seasonMonth: 0,
  },

  // February — Love Tides
  {
    id: "heart_angelfish", name: "Heart Angelfish", description: "A tropical fish with heart-shaped markings on its fins.",
    price: 1500, category: "fish", rarity: "rare", emoji: "💕", weight: 90, xp: 28,
    pros: ["February exclusive", "Romantic gift"], cons: ["Very shy"], seasonMonth: 1,
  },
  {
    id: "cupid_seahorse", name: "Cupid Seahorse", description: "A tiny seahorse said to bring luck in love.",
    price: 5000, category: "fish", rarity: "epic", emoji: "💘", weight: 25, xp: 60,
    pros: ["February exclusive", "Brings good fortune"], cons: ["Tiny and hard to spot"], seasonMonth: 1,
  },

  // March — Spring Bloom
  {
    id: "blossom_koi", name: "Blossom Koi", description: "A koi fish with cherry blossom patterns across its scales.",
    price: 1800, category: "fish", rarity: "rare", emoji: "🌸", weight: 85, xp: 30,
    pros: ["March exclusive", "Stunning patterns"], cons: ["Fragile scales"], seasonMonth: 2,
  },
  {
    id: "pollen_pufferfish", name: "Pollen Pufferfish", description: "Puffs up releasing golden pollen clouds underwater.",
    price: 5500, category: "fish", rarity: "epic", emoji: "🐡", weight: 22, xp: 65,
    pros: ["March exclusive", "Mesmerizing display"], cons: ["Causes underwater sneezing"], seasonMonth: 2,
  },

  // April — Fool's Tide
  {
    id: "trick_fish", name: "Trick Fish", description: "Looks valuable but might just be a cleverly disguised boot.",
    price: 200, category: "fish", rarity: "uncommon", emoji: "🃏", weight: 400, xp: 8,
    pros: ["April exclusive", "Amusing"], cons: ["Probably worthless"], seasonMonth: 3,
  },
  {
    id: "rubber_ducky", name: "Rubber Ducky", description: "Wait... this isn't even a real fish.",
    price: 8000, category: "fish", rarity: "legendary", emoji: "🦆", weight: 6, xp: 100,
    pros: ["April exclusive", "Collectors pay fortunes"], cons: ["It squeaks"], seasonMonth: 3,
  },

  // May — Deep Current
  {
    id: "pressure_shark", name: "Pressure Shark", description: "A deep-water predator that thrives under extreme pressure.",
    price: 3200, category: "fish", rarity: "epic", emoji: "🦈", weight: 28, xp: 55,
    pros: ["May exclusive", "Fearsome"], cons: ["Extremely dangerous"], seasonMonth: 4,
  },
  {
    id: "hydrothermal_vent_fish", name: "Vent Crawler", description: "Lives near volcanic vents on the ocean floor.",
    price: 15000, category: "fish", rarity: "legendary", emoji: "🌋", weight: 5, xp: 130,
    pros: ["May exclusive", "Unique biology"], cons: ["Scalding hot"], seasonMonth: 4,
  },

  // June — Summer Splash
  {
    id: "surfing_swordfish", name: "Surfing Swordfish", description: "Rides the summer waves with its sword-like bill.",
    price: 1400, category: "fish", rarity: "rare", emoji: "🏄", weight: 95, xp: 26,
    pros: ["June exclusive", "Radical catch"], cons: ["Too cool for you"], seasonMonth: 5,
  },
  {
    id: "beach_crab", name: "Beach Crab", description: "A colorful crab wearing a tiny pair of sunglasses.",
    price: 600, category: "fish", rarity: "uncommon", emoji: "🦀", weight: 350, xp: 10,
    pros: ["June exclusive", "Fashionable"], cons: ["Pinchy"], seasonMonth: 5,
  },

  // July — Coral Festival
  {
    id: "rainbow_coral", name: "Rainbow Coral", description: "A living coral polyp that glows in every color of the spectrum.",
    price: 2200, category: "fish", rarity: "rare", emoji: "🌈", weight: 80, xp: 32,
    pros: ["July exclusive", "Stunning display"], cons: ["Very fragile"], seasonMonth: 6,
  },
  {
    id: "pearl_oyster", name: "Pearl Oyster", description: "Contains a perfectly spherical pearl worth a fortune.",
    price: 7000, category: "fish", rarity: "epic", emoji: "🦪", weight: 20, xp: 70,
    pros: ["July exclusive", "Contains pearl"], cons: ["Hard to open"], seasonMonth: 6,
  },

  // August — Monsoon
  {
    id: "thunder_eel", name: "Thunder Eel", description: "An electric eel supercharged by monsoon lightning.",
    price: 2800, category: "fish", rarity: "epic", emoji: "⚡", weight: 32, xp: 50,
    pros: ["August exclusive", "Electric powers"], cons: ["Shocking to touch"], seasonMonth: 7,
  },
  {
    id: "storm_manta", name: "Storm Manta", description: "A massive ray that only surfaces during the fiercest storms.",
    price: 18000, category: "fish", rarity: "legendary", emoji: "🌊", weight: 4, xp: 140,
    pros: ["August exclusive", "Awe-inspiring"], cons: ["Dangerous waters"], seasonMonth: 7,
  },

  // September — Harvest Tide
  {
    id: "golden_salmon", name: "Golden Salmon", description: "A salmon with scales of pure gold, swimming upstream to spawn.",
    price: 2500, category: "fish", rarity: "rare", emoji: "🥇", weight: 75, xp: 35,
    pros: ["September exclusive", "Valuable scales"], cons: ["Slippery"], seasonMonth: 8,
  },
  {
    id: "pumpkin_puffer", name: "Pumpkin Puffer", description: "A round orange pufferfish that looks exactly like a pumpkin.",
    price: 6000, category: "fish", rarity: "epic", emoji: "🎃", weight: 24, xp: 62,
    pros: ["September exclusive", "Festive"], cons: ["Spiky when scared"], seasonMonth: 8,
  },

  // October — Spooky Seas
  {
    id: "ghost_fish", name: "Ghost Fish", description: "A translucent fish that phases through nets. Spooky.",
    price: 3000, category: "fish", rarity: "epic", emoji: "👻", weight: 26, xp: 52,
    pros: ["October exclusive", "Phasing ability"], cons: ["Hard to keep in inventory"], seasonMonth: 9,
  },
  {
    id: "skeleton_swordfish", name: "Skeleton Swordfish", description: "The animated bones of an ancient swordfish.",
    price: 20000, category: "fish", rarity: "legendary", emoji: "💀", weight: 4, xp: 150,
    pros: ["October exclusive", "Undead rarity"], cons: ["Literally just bones"], seasonMonth: 9,
  },

  // November — Migration
  {
    id: "phoenix_fish", name: "Phoenix Fish", description: "A fiery fish reborn from the ashes of autumn waters.",
    price: 25000, category: "fish", rarity: "legendary", emoji: "🔥", weight: 3, xp: 160,
    pros: ["November exclusive", "Reborn from flames"], cons: ["Burns your tackle"], seasonMonth: 10,
  },
  {
    id: "eagle_ray", name: "Eagle Ray", description: "A majestic ray that migrates thousands of miles each year.",
    price: 2000, category: "fish", rarity: "rare", emoji: "🦅", weight: 70, xp: 34,
    pros: ["November exclusive", "Long-distance traveler"], cons: ["Only passing through"], seasonMonth: 10,
  },

  // December — Frost Gala
  {
    id: "snow_globe_fish", name: "Snow Globe Fish", description: "A perfectly round fish that creates swirling snow when shaken.",
    price: 3500, category: "fish", rarity: "epic", emoji: "🎄", weight: 28, xp: 55,
    pros: ["December exclusive", "Magical display"], cons: ["Don't shake too hard"], seasonMonth: 11,
  },
  {
    id: "candy_cane_eel", name: "Candy Cane Eel", description: "A red-and-white striped eel that tastes like peppermint.",
    price: 1600, category: "fish", rarity: "rare", emoji: "🍬", weight: 85, xp: 30,
    pros: ["December exclusive", "Tasty"], cons: ["Sticky"], seasonMonth: 11,
  },
];
