# 🎣 baitin

<div align="center">

> _Ever wanted to be a fisherman? Well now you can._

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Redis](https://img.shields.io/badge/Redis-FF4438?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-orange?style=for-the-badge)](LICENSE)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-red?style=for-the-badge)]()

**A full-featured Discord fishing economy bot built with TypeScript and Discord.js v14. Cast lines, catch fish, build your fortune, and compete with your server.**

[Getting Started](#-getting-started) · [Economy System](#-economy-system) · [Commands](#-commands) · [Architecture](#-architecture) · [Generators](#-generators) · [Docker](#-docker)

</div>

---

## ✨ Features

- 🎣 **Deep fishing gameplay** — cast lines, reel in fish of varying rarity, weight, and value
- 💰 **Full economy system** — wallet, bank, shop, upgrades, leaderboards, and player-to-player trading
- ⚡ **Dynamic loading** — commands and events are auto-discovered and registered at startup; no manual imports required
- 🔧 **Interactive generators** — scaffold new commands and events in seconds via the built-in CLI
- 🗃️ **Drizzle ORM** — type-safe, schema-first database access with full migration support (PostgreSQL)
- 🔴 **Redis** — cooldowns, session state, and leaderboard caching powered by Redis out of the box
- 🐳 **Docker support** — fully containerised with `docker-compose` for one-command deployment of bot + DB + Redis
- 🧩 **Modular architecture** — clean separation of core, commands, events, modules, and utilities

---

## 📦 Tech Stack

| Layer            | Technology               |
| ---------------- | ------------------------ |
| Language         | TypeScript               |
| Runtime          | Bun >= 1.0               |
| Bot Framework    | Discord.js v14           |
| Database ORM     | Drizzle ORM (PostgreSQL) |
| Cache            | Redis                    |
| Containerisation | Docker + Docker Compose  |

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Docker & Docker Compose](https://www.docker.com/) _(optional — for the full containerised stack)_
- A Discord application & bot token from the [Discord Developer Portal](https://discord.com/developers/applications)

### 1. Clone the repository

```bash
git clone https://github.com/wrlliam/baitin.git
cd baitin
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

```bash
cp env.example .env
```

Open `.env` and fill in your values:

```env
# ── Discord ───────────────────────────────────────────
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_dev_guild_id_here     # optional: guild-scoped commands in dev

# ── Database (PostgreSQL) ──────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/baitin

# ── Redis ─────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
```

### 4. Run database migrations

```bash
bun run db:migrate
```

### 5. Start the bot

```bash
# Development — hot reload
bun run dev

# Production
bun run start
```

---

## 🐳 Docker

Spin up the entire stack — bot, PostgreSQL, and Redis — with a single command.

```bash
# Start all services
docker compose up -d

# View bot logs
docker compose logs -f bot

# Stop everything
docker compose down

# Rebuild after code changes
docker compose up -d --build bot
```

The Compose stack runs three services:

```
┌──────────────────────────────────────────────┐
│  docker-compose                              │
│                                              │
│  ┌─────────┐   ┌────────────┐  ┌─────────┐  │
│  │   bot   │──▶│ postgresql │  │  redis  │  │
│  │         │   │   :5432    │  │  :6379  │  │
│  └─────────┘   └────────────┘  └─────────┘  │
└──────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
baitin/
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
├── env.example
├── package.json
├── tsconfig.json
│
├── scripts/
│   ├── generate-command.ts    # Interactive command scaffolder
│   └── generate-event.ts      # Interactive event scaffolder
│
└── src/
    ├── index.ts               # Entry point — boots the client
    ├── config.ts              # Bot-wide configuration constants
    ├── env.ts                 # Environment variable parsing & validation
    │
    ├── commands/              # Slash commands, grouped by category
    │   ├── fishing/
    │   │   ├── CastCommand.ts
    │   │   ├── InventoryCommand.ts
    │   │   ├── CollectionCommand.ts
    │   │   └── UpgradeCommand.ts
    │   ├── economy/
    │   │   ├── BalanceCommand.ts
    │   │   ├── DepositCommand.ts
    │   │   ├── WithdrawCommand.ts
    │   │   ├── DailyCommand.ts
    │   │   ├── WorkCommand.ts
    │   │   ├── ShopCommand.ts
    │   │   ├── BuyCommand.ts
    │   │   ├── SellCommand.ts
    │   │   ├── TradeCommand.ts
    │   │   └── LeaderboardCommand.ts
    │   └── misc/
    │       ├── HelpCommand.ts
    │       └── EchoCommand.ts
    │
    ├── events/                # Discord.js client event handlers
    │   ├── InteractionCreateEvent.ts
    │   └── ReadyEvent.ts
    │
    ├── listeners/             # Supplementary listener logic
    │   └── index.ts
    │
    ├── core/
    │   ├── Core.ts            # Client setup & dynamic command/event loader
    │   ├── Embed.ts           # Reusable embed builder helpers
    │   └── typings.ts         # Shared types — Command, Event, etc.
    │
    ├── db/
    │   ├── index.ts           # Drizzle client
    │   ├── redis.ts           # Redis client
    │   └── schema.ts          # Table definitions
    │
    ├── modules/               # Self-contained feature modules
    │   ├── index.ts
    │   └── management/
    │       └── logging.ts
    │
    └── utils/
        ├── index.ts
        ├── logger.ts          # Structured logger
        ├── misc.ts            # General helpers
        ├── pagination.ts      # Paginated embed utility
        └── permissions.ts     # Permission helpers
```

---

## ⚙️ Architecture

### Dynamic Command Loading

`Core.ts` recursively scans `src/commands/**` at startup. Any file that exports a valid `Command` object is automatically registered — no manual import list needed.

```typescript
// src/core/typings.ts
import {
  ApplicationCommandType,
  ChatInputCommandInteraction,
} from "discord.js";

export interface Command {
  name: string;
  description: string;
  type: ApplicationCommandType;
  usage: string[];
  options?: unknown[];
  run: (args: { ctx: ChatInputCommandInteraction }) => Promise<void>;
}
```

Dropping a new file into `src/commands/<category>/` is all it takes — the loader picks it up on next start.

### Dynamic Event Loading

The same auto-discovery pattern applies to events. Any file in `src/events/` that exports a valid `Event` object is registered against the Discord.js client automatically.

```typescript
// src/core/typings.ts
import { ClientEvents } from "discord.js";

export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  run: (...args: ClientEvents[K]) => Promise<void>;
}
```

### Redis Cooldowns

All per-user command cooldowns are managed through Redis so they survive restarts and work across potential shards:

| Key pattern                   | Purpose            | TTL            |
| ----------------------------- | ------------------ | -------------- |
| `cooldown:{userId}:{command}` | Per-command gate   | Dynamic        |
| `leaderboard:networth`        | Cached sorted set  | 5 min          |
| `session:trade:{userId}`      | Active trade state | 2 min          |
| `daily:{userId}`              | Daily claim lock   | Until midnight |
| `fish:prices`                 | Market price cache | 1 hour         |

---

## 🐟 Economy System

### Currency

| Concept           | Description                                            |
| ----------------- | ------------------------------------------------------ |
| **Wallet**        | Liquid coins ready to spend                            |
| **Bank**          | Protected storage; earns passive daily interest        |
| **Bank Capacity** | Maximum bank balance, upgradeable via the shop         |
| **Net Worth**     | Wallet + Bank + inventory value; used for leaderboards |

### Earning Money

| Source   | How                                               |
| -------- | ------------------------------------------------- |
| `/cast`  | Catch fish and sell them                          |
| `/sell`  | Bulk-sell items from your inventory               |
| `/daily` | Claim a daily reward; streaks increase the payout |
| `/work`  | Passive income on a cooldown timer                |
| Trading  | Exchange items with other players via `/trade`    |

### Fish Rarity Tiers

```
⬜  Common      ──  Very frequent  ──  Low value
🟩  Uncommon    ──  Frequent       ──  Moderate value
🟦  Rare        ──  Occasional     ──  Good value
🟪  Epic        ──  Uncommon       ──  High value
🟧  Legendary   ──  Very rare      ──  Excellent value
🟥  Mythic      ──  Extremely rare ──  Exceptional value
```

Each fish has a base sell value, a weight range, and a weight multiplier — heavier catches are worth more.

### Upgrades & Shop

Items in `/shop` fall into two categories:

- **Equipment** — fishing rods, bait, and boats that improve catch rate, fish quality, and inventory size
- **Upgrades** — passive bonuses such as bank capacity increases, cooldown reducers, and luck boosts

---

## 🎮 Commands

### 🎣 Fishing

| Command       | Description                               |
| ------------- | ----------------------------------------- |
| `/cast`       | Cast your line and reel in a catch        |
| `/inventory`  | View fish and items currently in your bag |
| `/collection` | Browse your full lifetime catch log       |
| `/upgrade`    | View and equip fishing upgrades           |

### 💰 Economy

| Command              | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `/balance [user]`    | Check wallet and bank balances                         |
| `/deposit <amount>`  | Move coins from wallet → bank                          |
| `/withdraw <amount>` | Move coins from bank → wallet                          |
| `/daily`             | Claim your daily reward                                |
| `/work`              | Earn passive income (cooldown-gated)                   |
| `/sell <item> [qty]` | Sell fish or items from inventory                      |
| `/shop`              | Browse the item and upgrade shop                       |
| `/buy <item> [qty]`  | Purchase an item from the shop                         |
| `/trade @user`       | Initiate a trade with another player                   |
| `/leaderboard`       | Top players by net worth, fish caught, or rarest catch |

### 🛠️ Misc

| Command           | Description                             |
| ----------------- | --------------------------------------- |
| `/help [command]` | Show help for all or a specific command |
| `/echo <text>`    | Repeat a message back                   |

---

## ⚡ Generators

Instead of writing boilerplate by hand, use the built-in CLI scripts to scaffold new commands and events instantly.

### Generate a command

```bash
bun run generate:command
```

The prompt will ask for a name, category, description, cooldown, and any options — then write a fully typed file:

```typescript
// src/commands/fishing/FishStatsCommand.ts
import { ApplicationCommandType } from "discord.js";
import type { Command } from "@/core/typings";

export default {
  name: "fish-stats",
  description: "View detailed stats for a fish species.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/fish-stats <species>"],
  options: [],
  run: async ({ ctx }) => {
    await ctx.reply({ content: "fish-stats executed!", ephemeral: true });
  },
} satisfies Command;
```

### Generate an event

```bash
bun run generate:event
```

The prompt lets you search across all ~90 Discord.js client events, shows the correct argument types, and writes a fully typed handler:

```typescript
// src/events/GuildMemberAddEvent.ts
import type { Event } from "@/core/typings";

export default {
  name: "guildMemberAdd",
  once: false,
  run: async (member) => {
    // Your logic here
  },
} satisfies Event<"guildMemberAdd">;
```

Both generators are **fully self-contained** and never import from `src/`, so they cannot accidentally start the bot.

---

## 🗃️ Database (Drizzle ORM)

```typescript
// src/db/schema.ts

export const users = pgTable("users", {
  id: varchar("id", { length: 20 }).primaryKey(), // Discord snowflake
  username: text("username").notNull(),
  wallet: integer("wallet").default(0).notNull(),
  bank: integer("bank").default(0).notNull(),
  bankCap: integer("bank_cap").default(10_000).notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  streak: integer("streak").default(0).notNull(),
  lastDaily: timestamp("last_daily"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const catches = pgTable("catches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 20 })
    .notNull()
    .references(() => users.id),
  species: text("species").notNull(),
  rarity: text("rarity").notNull(),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }).notNull(),
  value: integer("value").notNull(),
  caughtAt: timestamp("caught_at").defaultNow().notNull(),
});

export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 20 })
    .notNull()
    .references(() => users.id),
  itemId: text("item_id").notNull(),
  quantity: integer("quantity").default(1).notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  fromId: varchar("from_id", { length: 20 }),
  toId: varchar("to_id", { length: 20 }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // 'sell' | 'buy' | 'trade' | 'daily' | 'deposit' | 'withdraw'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Database scripts

```bash
bun run db:generate   # Generate a migration from schema changes
bun run db:migrate    # Apply all pending migrations
bun run db:push       # Push schema directly (dev only)
bun run db:studio     # Open Drizzle Studio (visual browser)
```

---

## 📦 Scripts

| Script                     | Description                               |
| -------------------------- | ----------------------------------------- |
| `bun run dev`              | Start in development mode with hot reload |
| `bun run start`            | Start in production mode                  |
| `bun run generate:command` | Scaffold a new command                    |
| `bun run generate:event`   | Scaffold a new event                      |
| `bun run db:generate`      | Generate a Drizzle migration              |
| `bun run db:migrate`       | Apply pending migrations                  |
| `bun run db:push`          | Push schema directly (dev only)           |
| `bun run db:studio`        | Open Drizzle Studio                       |

---

## 🤝 Contributing

Pull requests are welcome! For anything beyond small fixes, please open an issue first to discuss the change.

1. Fork the repo and create a branch (`git checkout -b feat/my-feature`)
2. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat: add new fish species`)
3. Push and open a PR against `main`

---

## 📄 License

Distributed under the [Apache-2.0 License](LICENSE).

---

<div align="center">

Built with 🎣 by [wrlliam](https://github.com/wrlliam) — stars and contributions welcome!

[![GitHub stars](https://img.shields.io/github/stars/wrlliam/baitin?style=social)](https://github.com/wrlliam/baitin)
[![GitHub forks](https://img.shields.io/github/forks/wrlliam/baitin?style=social)](https://github.com/wrlliam/baitin/fork)

</div>
