import { redis } from "@/db/redis";
import type { BuffEffect, ActiveBuff } from "@/data/types";

const BUFF_KEY = (userId: string) => `buff:${userId}`;

export async function addBuff(userId: string, effects: BuffEffect[]): Promise<void> {
  const existing = await getActiveBuffs(userId);
  const now = Date.now();

  const newBuffs: ActiveBuff[] = effects.map((e) => ({
    type: e.type,
    amount: e.amount,
    expiresAt: now + e.durationMinutes * 60 * 1000,
  }));

  const merged = [...existing, ...newBuffs];
  const maxTtlMs = Math.max(...merged.map((b) => b.expiresAt - now));
  const ttlSeconds = Math.max(1, Math.ceil(maxTtlMs / 1000));

  await redis.set(BUFF_KEY(userId), JSON.stringify(merged));
  await redis.send("EXPIRE", [BUFF_KEY(userId), ttlSeconds.toString()]);
}

export async function getActiveBuffs(userId: string): Promise<ActiveBuff[]> {
  const data = await redis.get(BUFF_KEY(userId));
  if (!data) return [];

  const buffs = JSON.parse(data) as ActiveBuff[];
  const now = Date.now();
  return buffs.filter((b) => b.expiresAt > now);
}

/** Extend all active buffs by the given number of minutes. */
export async function extendBuff(userId: string, minutes: number): Promise<void> {
  const buffs = await getActiveBuffs(userId);
  if (buffs.length === 0) return;

  const extensionMs = minutes * 60 * 1000;
  const now = Date.now();

  const extended = buffs.map((b) => ({
    ...b,
    expiresAt: b.expiresAt + extensionMs,
  }));

  const maxTtlMs = Math.max(...extended.map((b) => b.expiresAt - now));
  const ttlSeconds = Math.max(1, Math.ceil(maxTtlMs / 1000));

  await redis.set(BUFF_KEY(userId), JSON.stringify(extended));
  await redis.send("EXPIRE", [BUFF_KEY(userId), ttlSeconds.toString()]);
}

export async function getBuffTotal(userId: string, type: BuffEffect["type"]): Promise<number> {
  const buffs = await getActiveBuffs(userId);
  return buffs.filter((b) => b.type === type).reduce((sum, b) => sum + b.amount, 0);
}

export async function applyBuffsToCalculation(
  userId: string,
  base: { xpMult: number; coinMult: number; rarityMult: number; cooldownSecs: number }
): Promise<typeof base> {
  const buffs = await getActiveBuffs(userId);

  let xpBoost = 0;
  let coinBoost = 0;
  let luckBoost = 0;
  let cooldownReduction = 0;

  for (const buff of buffs) {
    if (buff.type === "xp_boost") xpBoost += buff.amount;
    if (buff.type === "coin_boost") coinBoost += buff.amount;
    if (buff.type === "luck_boost") luckBoost += buff.amount;
    if (buff.type === "cooldown_reduction") cooldownReduction += buff.amount;
  }

  return {
    xpMult: base.xpMult * (1 + xpBoost),
    coinMult: base.coinMult * (1 + coinBoost),
    rarityMult: base.rarityMult + luckBoost,
    cooldownSecs: Math.max(5, Math.floor(base.cooldownSecs * (1 - cooldownReduction))),
  };
}
