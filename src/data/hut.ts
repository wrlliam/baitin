import type { HutUpgrade } from "./types";

export const hutSpeedUpgrades: HutUpgrade[] = [
  { level: 1, cost: 0, speedMinutes: 60 },
  { level: 2, cost: 1000, speedMinutes: 45 },
  { level: 3, cost: 3000, speedMinutes: 30 },
  { level: 4, cost: 8000, speedMinutes: 20 },
  { level: 5, cost: 20000, speedMinutes: 10 },
];

export const hutLuckUpgrades: HutUpgrade[] = [
  { level: 1, cost: 0, luckBonus: 0 },
  { level: 2, cost: 1000, luckBonus: 0.05 },
  { level: 3, cost: 3000, luckBonus: 0.10 },
  { level: 4, cost: 8000, luckBonus: 0.15 },
  { level: 5, cost: 20000, luckBonus: 0.20 },
];

export const hutInventoryUpgrades: HutUpgrade[] = [
  { level: 1, cost: 0, capacity: 10 },
  { level: 2, cost: 1500, capacity: 20 },
  { level: 3, cost: 5000, capacity: 35 },
  { level: 4, cost: 15000, capacity: 50 },
];
