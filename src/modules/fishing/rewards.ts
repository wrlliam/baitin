import { redis } from "@/db/redis";
import { addCoins, addXp } from "./economy";
import { addItem } from "./inventory";

export type RewardType = "daily" | "weekly" | "monthly";

interface Reward {
  coins: number;
  items: { id: string; type: string; qty: number }[];
  xp: number;
  ttl: number;
}

const REWARDS: Record<RewardType, Reward> = {
  daily: {
    coins: 300,
    items: [{ id: "earthworm", type: "bait", qty: 3 }],
    xp: 0,
    ttl: 86400,
  },
  weekly: {
    coins: 2000,
    items: [
      { id: "firefly_squid", type: "bait", qty: 5 },
      { id: "common_egg", type: "egg", qty: 1 },
    ],
    xp: 0,
    ttl: 604800,
  },
  monthly: {
    coins: 10000,
    items: [
      { id: "magnetic_lure", type: "bait", qty: 3 },
      { id: "rare_egg", type: "egg", qty: 1 },
    ],
    xp: 100,
    ttl: 2592000,
  },
};

function rewardKey(userId: string, type: RewardType): string {
  return `rewards:${type}:${userId}`;
}

export async function canClaimReward(
  userId: string,
  type: RewardType
): Promise<{ canClaim: boolean; expiresAt?: number }> {
  const key = rewardKey(userId, type);
  const val = await redis.get(key);
  if (!val) return { canClaim: true };
  return { canClaim: false, expiresAt: parseInt(val) };
}

export async function claimReward(
  userId: string,
  type: RewardType
): Promise<{ success: boolean; error?: string; reward?: Reward }> {
  const { canClaim } = await canClaimReward(userId, type);
  if (!canClaim) return { success: false, error: "Reward not available yet." };

  const reward = REWARDS[type];
  const expiresAt = Date.now() + reward.ttl * 1000;

  await addCoins(userId, reward.coins);
  for (const item of reward.items) {
    await addItem(userId, item.id, item.type, item.qty);
  }
  if (reward.xp > 0) {
    await addXp(userId, reward.xp);
  }

  const key = rewardKey(userId, type);
  await redis.set(key, expiresAt.toString());
  await redis.send("EXPIRE", [key, reward.ttl.toString()]);

  return { success: true, reward };
}

export { REWARDS };
