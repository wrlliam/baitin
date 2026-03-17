import { db } from "@/db";
import { fishingProfile, petInstance } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { eggItems, petItems } from "@/data";
import { getOrCreateProfile } from "./economy";
import { removeItem } from "./inventory";
import type { PetBuff } from "@/data/types";

const MAX_EQUIPPED_PETS = 3;

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

export async function equipPet(
  userId: string,
  petInstanceId: string
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOrCreateProfile(userId);

  if (profile.equippedPets.length >= MAX_EQUIPPED_PETS) {
    return { success: false, error: `You can only equip ${MAX_EQUIPPED_PETS} pets at once.` };
  }

  // Verify ownership
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
  const buffs: Record<string, number> = {};

  for (const instanceId of profile.equippedPets) {
    const instances = await db
      .select()
      .from(petInstance)
      .where(eq(petInstance.id, instanceId));

    if (!instances[0]) continue;

    const pet = petItems.get(instances[0].petId);
    if (!pet) continue;

    for (const buff of pet.buffs) {
      buffs[buff.type] = (buffs[buff.type] ?? 0) + buff.value;
    }
  }

  return buffs;
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
