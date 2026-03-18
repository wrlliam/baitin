import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string(),
    // REDIS_URL: z.string().optional(),

    DISCORD_CLIENT_ID: z.string(),
    DISCORD_CLIENT_SECRET: z.string().optional(),

    GUILD_ID: z.string(),
    INVITE_URL: z.string().optional(),
    REDIS_URL: z.string(),
    TOKEN: z.string(),
  },
  client: {},
  runtimeEnv: {
    REDIS_URL: process.env.REDIS_URL,

    DATABASE_URL: process.env.DATABASE_URL,
    // REDIS_URL: process.env.REDIS_URL,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    GUILD_ID: process.env.GUILD_ID,
    INVITE_URL: process.env.INVITE_URL,
    TOKEN: process.env.TOKEN,
  },
});
