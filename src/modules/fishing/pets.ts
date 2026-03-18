import { db } from "@/db";
import { fishingProfile, petInstance, eggIncubator } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { eggItems, petItems } from "@/data";
import { getOrCreateProfile } from "./economy";
import { subtractCoins } from "./economy";
import { removeItem } from "./inventory";
import { getBuffTotal } from "./buffs";
import type { PetBuff } from "@/data/types";

const MAX_EQUIPPED_PETS = 3;
const MAX_PET_LEVEL = 10;
const MAX_INCUBATING = 3;

// ── Incubation System ──

export async function startIncubation(
  userId: string,
  eggId: string
): Promise<{ success: boolean; error?: string; hatchesAt?: Date; incubatorId?: string }> {
  const egg = eggItems.get(eggId);
  if (!egg) return { success: false, error: "Invalid egg." };

  // Check incubator slots
  const active = await db
    .select()
    .from(eggIncubator)
    .where(and(eq(eggIncubator.userId, userId), eq(eggIncubator.hatched, false), eq(eggIncubator.failed, false)));

  if (active.length >= MAX_INCUBATING) {
    return { success: false, error: `You can only incubate ${MAX_INCUBATING} eggs at once.` };
  }

  const removed = await removeItem(userId, eggId, 1);
  if (!removed) return { success: false, error: "You don't have this egg." };

  // Apply hatch speed buffs
  const hatchSpeedBoost = await getBuffTotal(userId, "hatch_speed");
  const speedMultiplier = Math.max(0, 1 - hatchSpeedBoost); // hatch_speed of -1 pauses it (0 multiplier = instant? no, we clamp at 0.05)
  const effectiveMinutes = Math.max(1, Math.floor(egg.hatchTimeMinutes * Math.max(0.05, speedMultiplier)));

  const now = new Date();
  const hatchesAt = new Date(now.getTime() + effectiveMinutes * 60 * 1000);
  const incubatorId = createId();

  await db.insert(eggIncubator).values({
    id: incubatorId,
    userId,
    eggId,
    startedAt: now,
    hatchesAt,
  });

  return { success: true, hatchesAt, incubatorId };
}

export async function getIncubatingEggs(userId: string) {
  return db
    .select()
    .from(eggIncubator)
    .where(and(eq(eggIncubator.userId, userId), eq(eggIncubator.hatched, false), eq(eggIncubator.failed, false)));
}

export async function collectHatch(
  userId: string,
  incubatorId: string
): Promise<{ success: boolean; error?: string; petName?: string; petEmoji?: string; petId?: string; failed?: boolean }> {
  const rows = await db
    .select()
    .from(eggIncubator)
    .where(eq(eggIncubator.id, incubatorId));

  const row = rows[0];
  if (!row || row.userId !== userId) return { success: false, error: "Incubator not found." };
  if (row.hatched) return { success: false, error: "This egg has already been collected." };
  if (row.failed) return { success: false, error: "This egg already failed." };

  const now = new Date();
  if (now < row.hatchesAt) {
    const remaining = Math.ceil((row.hatchesAt.getTime() - now.getTime()) / 60000);
    return { success: false, error: `Not ready yet! ${remaining}m remaining.` };
  }

  const egg = eggItems.get(row.eggId);
  if (!egg) {
    await db.update(eggIncubator).set({ failed: true }).where(eq(eggIncubator.id, incubatorId));
    return { success: false, error: "Egg data not found.", failed: true };
  }

  // Check fail chance
  if (egg.failChance > 0 && Math.random() < egg.failChance) {
    await db.update(eggIncubator).set({ failed: true }).where(eq(eggIncubator.id, incubatorId));
    return { success: true, failed: true };
  }

  // Hatch a random pet
  const randomPetId = egg.possiblePets[Math.floor(Math.random() * egg.possiblePets.length)];
  const pet = petItems.get(randomPetId);
  if (!pet) {
    await db.update(eggIncubator).set({ failed: true }).where(eq(eggIncubator.id, incubatorId));
    return { success: false, error: "Failed to hatch — invalid pet data.", failed: true };
  }

  const instanceId = createId();
  await db.insert(petInstance).values({
    id: instanceId,
    userId,
    petId: randomPetId,
  });

  await db.update(eggIncubator).set({ hatched: true }).where(eq(eggIncubator.id, incubatorId));

  // Achievement: first pet hatched
  const { checkGearAchievements } = await import("./achievements");
  await checkGearAchievements(userId, { hatchedPet: true });

  return { success: true, petName: pet.name, petEmoji: pet.emoji, petId: instanceId };
}

// ── Legacy instant hatch (kept for backwards compat) ──

export async function hatchEgg(
  userId: string,
  eggId: string
): Promise<{ success: boolean; error?: string; petName?: string; petEmoji?: string; petId?: string }> {
  const egg = eggItems.get(eggId);
  if (!egg) return { success: false, error: "Invalid egg." };

  const removed = await removeItem(userId, eggId, 1);
  if (!removed) return { success: false, error: "You don't have this egg." };

  const randomPetId = egg.possiblePets[Math.floor(Math.random() * egg.possiblePets.length)];
  const pet = petItems.get(randomPetId);
  if (!pet) return { success: false, error: "Failed to hatch — invalid pet data." };

  const instanceId = createId();
  await db.insert(petInstance).values({
    id: instanceId,
    userId,
    petId: randomPetId,
  });

  return { success: true, petName: pet.name, petEmoji: pet.emoji, petId: instanceId };
}

// ── Pet Management ──

export async function equipPet(
  userId: string,
  petInstanceId: string
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOrCreateProfile(userId);

  if (profile.equippedPets.length >= MAX_EQUIPPED_PETS) {
    return { success: false, error: `You can only equip ${MAX_EQUIPPED_PETS} pets at once.` };
  }

  const instances = await db
    .select()
    .from(petInstance)
    .where(eq(petInstance.id, petInstanceId));

  if (!instances[0] || instances[0].userId !== userId) {
    return { success: false, error: "You don't own this pet." };
  }

  if (profile.equippedPets.includes(petInstanceId)) {
    return { success: false, error: "This pet is already equipped." };
  }

  await db
    .update(fishingProfile)
    .set({ equippedPets: [...profile.equippedPets, petInstanceId] })
    .where(eq(fishingProfile.userId, userId));

  return { success: true };
}

export async function unequipPet(
  userId: string,
  petInstanceId: string
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOrCreateProfile(userId);

  if (!profile.equippedPets.includes(petInstanceId)) {
    return { success: false, error: "This pet is not equipped." };
  }

  await db
    .update(fishingProfile)
    .set({ equippedPets: profile.equippedPets.filter((id) => id !== petInstanceId) })
    .where(eq(fishingProfile.userId, userId));

  return { success: true };
}

export async function getPetBuffs(userId: string): Promise<Record<string, number>> {
  const profile = await getOrCreateProfile(userId);
  const petEffectBoost = await getBuffTotal(userId, "pet_effect_boost");
  const buffs: Record<string, number> = {};

  for (const instanceId of profile.equippedPets) {
    const instances = await db
      .select()
      .from(petInstance)
      .where(eq(petInstance.id, instanceId));

    if (!instances[0]) continue;

    const pet = petItems.get(instances[0].petId);
    if (!pet) continue;

    const level = instances[0].petLevel ?? 1;
    const levelScalar = 1 + (level - 1) * 0.1;
    const petBoostScalar = 1 + petEffectBoost;

    for (const buff of pet.buffs) {
      buffs[buff.type] = (buffs[buff.type] ?? 0) + buff.value * levelScalar * petBoostScalar;
    }
  }

  return buffs;
}

export async function upgradePet(
  userId: string,
  petInstanceId: string
): Promise<{ success: boolean; error?: string; newLevel?: number }> {
  const instances = await db
    .select()
    .from(petInstance)
    .where(eq(petInstance.id, petInstanceId));

  if (!instances[0] || instances[0].userId !== userId) {
    return { success: false, error: "You don't own this pet." };
  }

  const currentLevel = instances[0].petLevel ?? 1;
  if (currentLevel >= MAX_PET_LEVEL) {
    return { success: false, error: `Pet is already at max level (${MAX_PET_LEVEL}).` };
  }

  const cost = 500 * currentLevel;
  const paid = await subtractCoins(userId, cost);
  if (!paid) return { success: false, error: `Not enough coins! Need ${cost.toLocaleString()} coins.` };

  const newLevel = currentLevel + 1;
  await db
    .update(petInstance)
    .set({ petLevel: newLevel })
    .where(eq(petInstance.id, petInstanceId));

  return { success: true, newLevel };
}

export async function getUserPets(userId: string) {
  return db.select().from(petInstance).where(eq(petInstance.userId, userId));
}

export async function renamePet(
  userId: string,
  petInstanceId: string,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  const instances = await db
    .select()
    .from(petInstance)
    .where(eq(petInstance.id, petInstanceId));

  if (!instances[0] || instances[0].userId !== userId) {
    return { success: false, error: "You don't own this pet." };
  }

  await db
    .update(petInstance)
    .set({ name: newName })
    .where(eq(petInstance.id, petInstanceId));

  return { success: true };
}
