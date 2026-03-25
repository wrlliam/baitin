export interface LevelReward {
  level: number;
  coins: number;
  gems: number;
  description: string;
}

/** Milestone rewards granted when a player reaches certain levels */
export const levelRewards: LevelReward[] = [
  { level: 5, coins: 1_000, gems: 0, description: "Novice Fisher" },
  { level: 10, coins: 5_000, gems: 1, description: "Apprentice Angler" },
  { level: 15, coins: 10_000, gems: 2, description: "Skilled Caster" },
  { level: 20, coins: 20_000, gems: 3, description: "Expert Fisher" },
  { level: 25, coins: 35_000, gems: 5, description: "Master Angler" },
  { level: 30, coins: 50_000, gems: 8, description: "Grandmaster Fisher" },
  { level: 40, coins: 100_000, gems: 12, description: "Legendary Angler" },
  { level: 50, coins: 200_000, gems: 20, description: "Mythic Fisher" },
  { level: 75, coins: 500_000, gems: 50, description: "Deep Sea Legend" },
  { level: 100, coins: 1_000_000, gems: 100, description: "Ocean God" },
];

export const levelRewardMap = new Map(levelRewards.map((r) => [r.level, r]));
