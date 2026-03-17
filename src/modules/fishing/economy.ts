import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createId } from "@/utils/misc";

export async function getOrCreateProfile(userId: string) {
  const existing = await db
    .select()
    .from(fishingProfile)
    .where(eq(fishingProfile.userId, userId));

  if (existing[0]) return existing[0];

  const id = createId();
  await db.insert(fishingProfile).values({ id, userId });

  const created = await db
    .select()
    .from(fishingProfile)
    .where(eq(fishingProfile.userId, userId));

  return created[0]!;
}

export async function addCoins(userId: string, amount: number) {
  await getOrCreateProfile(userId);
  await db
    .update(fishingProfile)
    .set({ coins: sql`${fishingProfile.coins} + ${amount}` })
    .where(eq(fishingProfile.userId, userId));
}

export async function subtractCoins(userId: string, amount: number): Promise<boolean> {
  const profile = await getOrCreateProfile(userId);
  if (profile.coins < amount) return false;

  await db
    .update(fishingProfile)
    .set({ coins: sql`${fishingProfile.coins} - ${amount}` })
    .where(eq(fishingProfile.userId, userId));

  return true;
}

export async function getBalance(userId: string): Promise<number> {
  const profile = await getOrCreateProfile(userId);
  return profile.coins;
}

export async function addXp(userId: string, amount: number): Promise<{ levelUp: boolean; newLevel: number }> {
  const profile = await getOrCreateProfile(userId);
  const newXp = profile.xp + amount;
  const xpPerLevel = 100;
  const newLevel = Math.floor(newXp / xpPerLevel) + 1;
  const levelUp = newLevel > profile.level;

  await db
    .update(fishingProfile)
    .set({
      xp: newXp,
      level: newLevel,
      totalCatches: sql`${fishingProfile.totalCatches} + 1`,
    })
    .where(eq(fishingProfile.userId, userId));

  return { levelUp, newLevel };
}
