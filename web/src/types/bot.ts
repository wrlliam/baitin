export type ItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export interface BotFish {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  rarity: ItemRarity;
  emoji: string;
  weight: number;
  xp: number;
  pros: string[];
  cons: string[];
}

export interface BotRod {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  rarity: ItemRarity;
  emoji: string;
  buyPrice: number;
  luckBonus: number;
  speedReduction: number;
  durability: number;
}

export interface BotBait {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  rarity: ItemRarity;
  emoji: string;
  buyPrice: number;
  rarityMultiplier: number;
  junkModifier: number;
  consumedOnUse: boolean;
}

export interface PetBuff {
  type: "xp_boost" | "coin_boost" | "luck_boost" | "cooldown_reduction";
  value: number;
}

export interface BotPet {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  emoji: string;
  buffs: PetBuff[];
  pros: string[];
  cons: string[];
}

export interface BotPotion {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  rarity: ItemRarity;
  emoji: string;
  effects: Array<{
    type: string;
    amount: number;
    durationMinutes: number;
  }>;
}

export interface BotEgg {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  rarity: ItemRarity;
  emoji: string;
  possiblePets: string[];
  hatchTimeMinutes: number;
  failChance: number;
}

export interface BotEvent {
  id: string;
  name: string;
  description: string;
  effects: Array<{ type: string; value: number }>;
  schedule?: string;
  duration: number;
  entryFee?: number;
}

export interface CommandOption {
  name: string;
  description: string;
  type: number;
  required?: boolean;
  options?: CommandOption[];
  choices?: Array<{ name: string; value: string }>;
}

export interface BotCommand {
  name: string;
  description: string;
  category: string;
  usage: string[];
  adminOnly: boolean;
  devOnly: boolean;
  options: CommandOption[];
}
