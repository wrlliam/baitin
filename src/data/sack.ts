import type { SackTier } from "./types";

export const sackTiers: SackTier[] = [
  { level: 1, capacity: 15, upgradeCost: 0 },
  { level: 2, capacity: 30, upgradeCost: 500 },
  { level: 3, capacity: 50, upgradeCost: 2000 },
  { level: 4, capacity: 75, upgradeCost: 5000 },
  { level: 5, capacity: 100, upgradeCost: 15000 },
];
