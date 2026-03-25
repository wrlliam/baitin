/**
 * Scaling XP leveling system.
 *
 * Each level N requires N * 200 XP to complete.
 * Level 1 → 200 XP, Level 2 → 400 XP, Level 3 → 600 XP, etc.
 *
 * Total XP to reach level N = sum(1..N-1) * 200 = N*(N-1)/2 * 200
 *                            = 100 * N * (N-1)
 */

/** XP required to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return level * 200;
}

/** Total cumulative XP needed to reach the START of `level`. */
export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * level * (level - 1); // sum(1..level-1) * 200
}

/** Derive the current level from total accumulated XP. */
export function getLevel(totalXp: number): number {
  if (totalXp <= 0) return 1;
  // Solve: 100 * L * (L-1) <= totalXp  →  L = floor((1 + sqrt(1 + totalXp/25)) / 2)
  const level = Math.floor((1 + Math.sqrt(1 + totalXp / 25)) / 2);
  // Clamp: if rounding pushed us past the actual threshold, step back
  return totalXpForLevel(level) <= totalXp ? level : level - 1;
}

/** XP progress into the current level (for progress bars). */
export function xpIntoCurrentLevel(totalXp: number): number {
  const level = getLevel(totalXp);
  return totalXp - totalXpForLevel(level);
}
