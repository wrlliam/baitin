import { env } from "@/env";
import { RedisClient } from "bun";

let redis: RedisClient;

if (!globalThis.redis) {
  globalThis.redis = new RedisClient(env.REDIS_URL);
}
redis = globalThis.redis;

export { redis };
