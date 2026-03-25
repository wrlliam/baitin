/**
 * Migrates all bot tables from the `public` schema to the `bot` schema.
 * Uses ALTER TABLE ... SET SCHEMA which is atomic and requires no data copying.
 *
 * Run with: bun run scripts/migrate-to-bot-schema.ts
 */

import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const BOT_TABLES = [
  "leveling",
  "fishing_profile",
  "fishing_inventory",
  "hut",
  "hut_inventory",
  "pet_instance",
  "market_listing",
  "hut_notifications",
  "egg_incubator",
  "guild_settings",
  "fishing_log",
  "achievement",
  "player_quest",
  "trade_log",
  "lottery_ticket",
  "lottery_draw",
  "bounty",
  "player_upgrades",
  "user_ban",
  "user_report",
];

const sql = postgres(DATABASE_URL);

async function main() {
  console.log("Creating schema 'bot' if it doesn't exist...");
  await sql`CREATE SCHEMA IF NOT EXISTS bot`;
  console.log("Schema 'bot' ready.");

  // Check which tables exist in public schema
  const existingRows = await sql<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = ANY(${BOT_TABLES})
  `;
  const existingInPublic = new Set(existingRows.map((r) => r.tablename));

  // Check which tables already exist in bot schema
  const alreadyMovedRows = await sql<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'bot'
      AND tablename = ANY(${BOT_TABLES})
  `;
  const alreadyInBot = new Set(alreadyMovedRows.map((r) => r.tablename));

  let moved = 0;
  let skipped = 0;

  for (const table of BOT_TABLES) {
    if (alreadyInBot.has(table)) {
      console.log(`  SKIP  ${table} (already in bot schema)`);
      skipped++;
      continue;
    }
    if (!existingInPublic.has(table)) {
      console.log(`  SKIP  ${table} (not found in public schema)`);
      skipped++;
      continue;
    }

    // ALTER TABLE is atomic — moves the table with all its data, indexes, constraints
    await sql`ALTER TABLE ${sql(`public.${table}`)} SET SCHEMA bot`;
    console.log(`  MOVED ${table}  public.${table} → bot.${table}`);
    moved++;
  }

  console.log(`\nDone. ${moved} table(s) moved, ${skipped} skipped.`);

  // Verify final state
  const finalRows = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'bot' ORDER BY tablename
  `;
  console.log(`\nTables now in 'bot' schema: ${finalRows.map((r) => r.tablename).join(", ")}`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
