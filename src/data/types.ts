export type ItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type ItemCategory =
  | "fish"
  | "junk"
  | "bait"
  | "rod"
  | "egg"
  | "pet"
  | "misc";

export interface BaseItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ItemCategory;
  rarity: ItemRarity;
  emoji: string;
}

export interface Fish extends BaseItem {
  category: "fish";
  weight: number;
  xp: number;
  pros: string[];
  cons: string[];
}

export interface JunkItem extends BaseItem {
  category: "junk";
  weight: number;
  pros: string[];
  cons: string[];
}

export interface Rod extends BaseItem {
  category: "rod";
  buyPrice: number;
  luckBonus: number;
  speedReduction: number;
  durability: number;
}

export interface Bait extends BaseItem {
  category: "bait";
  buyPrice: number;
  rarityMultiplier: number;
  junkModifier: number;
  consumedOnUse: boolean;
}

export interface PetBuff {
  type: "xp_boost" | "coin_boost" | "luck_boost" | "cooldown_reduction";
  value: number;
}

export interface Pet {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  emoji: string;
  buffs: PetBuff[];
  pros: string[];
  cons: string[];
}

export interface Egg extends BaseItem {
  category: "egg";
  possiblePets: string[];
  hatchTimeMinutes: number;
  failChance: number; // 0–1, chance the egg fails to hatch
}

export interface SackTier {
  level: number;
  capacity: number;
  upgradeCost: number;
}

export interface HutUpgrade {
  level: number;
  cost: number;
  speedMinutes?: number;
  luckBonus?: number;
  capacity?: number;
}

export type EventEffectType =
  | "xp_multiplier"
  | "catch_rate"
  | "rarity_boost"
  | "coin_multiplier"
  | "cooldown_reduction"
  | "junk_reduction";

export interface EventEffect {
  type: EventEffectType;
  value: number;
}

export interface GameEvent {
  id: string;
  name: string;
  description: string;
  effects: EventEffect[];
  schedule?: string;
  duration: number;
  entryFee?: number;
}

export interface CatchResult {
  item: Fish | JunkItem;
  xpGained: number;
  coinsGained: number;
  baitConsumed: boolean;
  hutDrop: boolean;
  levelUp: boolean;
  newLevel?: number;
  rodBroke?: boolean;
  rodName: string;
  streakDay?: number;
  streakBonus?: boolean;
  newAchievements?: import("@/data/achievements").AchievementDef[];
  baitRemaining?: number | null;
  baitRanOut?: boolean;
  autoSold?: boolean;
  autoSoldCoins?: number;
  fotd?: boolean;
}

export interface BuffEffect {
  type: "xp_boost" | "coin_boost" | "luck_boost" | "cooldown_reduction" | "hatch_speed" | "pet_effect_boost" | "cost_reduction";
  amount: number; // positive = buff, negative = debuff
  durationMinutes: number;
}

export interface Potion extends BaseItem {
  category: "misc";
  effects: BuffEffect[];
}

export interface ActiveBuff {
  type: BuffEffect["type"];
  amount: number;
  expiresAt: number; // Unix ms
}
