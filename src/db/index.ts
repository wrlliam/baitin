import { env } from "@/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schemas from "./schema";

const client = postgres(env.DATABASE_URL!, {
  max_lifetime: 1800,
});

export const db = drizzle(client, {
  schema: { ...schemas },
});
