import { getCurrentSeason, getDaysRemaining } from "@/data/seasons";
import { seasonalFish } from "@/data/seasonal-fish";
import type { Fish } from "@/data/types";

export { getCurrentSeason, getDaysRemaining };

/** Get the seasonal fish available this month */
export function getSeasonalFish(): Fish[] {
  const month = new Date().getUTCMonth();
  return seasonalFish.filter((f) => f.seasonMonth === month);
}
