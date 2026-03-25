# Baitin 🎣

<div align="center">

> _Ever wanted to be a fisherman? Well now you can._

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![Discord.js](https://img.shields.io/badge/Discord.js_v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Redis](https://img.shields.io/badge/Redis-FF4438?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-orange?style=for-the-badge)](LICENSE)

**A full-featured Discord fishing economy bot built with TypeScript and Discord.js v14. Cast lines, catch fish, build your fortune, and compete with your server.**

[Getting Started](#getting-started) · [Commands](#commands) · [Architecture](#architecture) · [Contributing](#contributing)

</div>

---

## Features

- **Fishing** -- cast lines with rods, bait, pets, event bonuses, and streak multipliers
- **Economy** -- daily, weekly, and monthly rewards plus work, steal, flip, slots, crime, beg, search, and gambling
- **Fishing Huts** -- player-owned huts with passive income and upgradeable speed, luck, and inventory
- **Player Market** -- buy and sell items with auction and bidding support
- **Pet System** -- egg incubation, hatching, equipping, upgrading, and renaming pets
- **Potion Buffs** -- active buff system with XP, coin, luck, and rarity modifiers
- **Achievements & Almanac** -- track lifetime progress and fish discoveries
- **Events** -- random fishing events with server-wide bonuses and guild announcements

---

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Runtime        | Bun >= 1.0                          |
| Language       | TypeScript 5                        |
| Discord        | discord.js v14, Components V2       |
| Database       | PostgreSQL + Drizzle ORM            |
| Cache/Cooldowns| Redis (Bun native client)           |
| Deploy         | Docker Compose                      |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- PostgreSQL
- Redis
- A Discord bot token from the [Developer Portal](https://discord.com/developers/applications)

### Setup

```bash
git clone https://github.com/wrlliam/baitin.git
cd baitin
bun install
```

Create a `.env` file with the following variables:

```env
TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
GUILD_ID=your_dev_guild_id        # dev/testing guild
DATABASE_URL=postgresql://user:password@localhost:5432/baitin
REDIS_URL=redis://localhost:6379
API_PORT=3001
```

Push the database schema and start the bot:

```bash
bun run db:push
bun run dev
```

---

## Commands

### Fishing

| Command        | Description                                      |
| -------------- | ------------------------------------------------ |
| `/cast`        | Cast your line and reel in a catch               |
| `/sack`        | View and manage your inventory (upgrade capacity)|
| `/sell`        | Sell fish and items from your inventory          |
| `/release`     | Release fish back into the water                 |
| `/shop`        | Browse and buy rods, bait, potions, and upgrades |
| `/equip`       | Equip a rod or bait                              |
| `/use`         | Use a consumable item (potion, etc.)             |
| `/buffs`       | View your active potion buffs                    |
| `/profile`     | View your fishing profile and stats              |
| `/leaderboard` | Top players by various categories                |
| `/almanac`     | Browse your lifetime fish discovery log          |
| `/achievements`| View your achievement progress                   |
| `/fishoff`     | Challenge another player to a fishing competition|
| `/event`       | Check the currently active fishing event         |
| `/tip`         | Get a random fishing tip                         |
| `/settings`    | Configure personal bot settings                  |

### Economy

| Command      | Description                            |
| ------------ | -------------------------------------- |
| `/balance`   | Check your coin balance                |
| `/daily`     | Claim your daily reward (streak bonus) |
| `/weekly`    | Claim your weekly reward               |
| `/monthly`   | Claim your monthly reward              |
| `/work`      | Earn income on a cooldown              |
| `/steal`     | Attempt to steal coins from a player   |
| `/crime`     | Commit a crime for a risky payout      |
| `/heist`     | Organize a group heist for big payouts |
| `/beg`       | Beg for spare coins                    |
| `/search`    | Search locations for hidden coins      |
| `/rep`       | Give reputation to another player      |
| `/give`      | Give coins to another player           |
| `/trade`     | Trade items with another player        |
| `/drop`      | Drop a random reward for the server    |
| `/giftbox`   | Open a gift box for random rewards     |
| `/bounty`    | Place or claim a bounty on a player    |
| `/duel`      | Challenge another player to a duel     |
| `/lottery`   | Buy lottery tickets for a jackpot      |
| `/quests`    | View and track your active quests      |
| `/flip`      | Coin flip gamble                       |
| `/slots`     | Play the slot machine                  |
| `/gamble`    | Gamble coins on various games          |
| `/blackjack` | Play blackjack                         |

### Market

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `/market list`          | Browse active market listings   |
| `/market sell`          | Create a listing or auction     |
| `/market buy`           | Purchase a market listing       |
| `/market bid`           | Place a bid on an auction       |

### Pets & Hut

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `/pets list`      | View your pets                              |
| `/pets equip`     | Equip a pet for fishing bonuses             |
| `/pets incubate`  | Start incubating an egg                     |
| `/pets collect`   | Collect a hatched pet                       |
| `/pets upgrade`   | Upgrade a pet                               |
| `/pets rename`    | Rename a pet                                |
| `/hut`            | Manage your fishing hut and collect passive income |

### General

| Command            | Description                                |
| ------------------ | ------------------------------------------ |
| `/help`            | Show help for all or a specific command    |
| `/wiki`            | Look up game items and mechanics           |
| `/getting-started` | New player guide                           |
| `/ping`            | Check bot latency                          |
| `/avatar`          | View a user's avatar                       |
| `/userinfo`        | View user information                      |
| `/serverinfo`      | View server information                    |
| `/8ball`           | Ask the magic 8-ball                       |

### Admin

| Command                    | Description                              |
| -------------------------- | ---------------------------------------- |
| `/setup event-channel`     | Set the channel for event announcements  |
| `/setup event-channel-clear`| Clear the event announcement channel    |
| `/setup view`              | View current server settings             |

---

## Project Structure

```
src/
├── commands/              # Slash command handlers
│   ├── fishing/           # Fishing, inventory, market, pets, hut
│   ├── economy/           # Daily, work, steal, gamble, slots, etc.
│   ├── general/           # Setup, ping, avatar, userinfo
│   ├── misc/              # Help, echo
│   └── dev/               # Developer/debug commands
├── modules/fishing/       # Business logic
│   ├── fishing.ts         # Core catch mechanics
│   ├── economy.ts         # Coins, XP, profiles
│   ├── economy_games.ts   # Gambling game logic
│   ├── inventory.ts       # Inventory management
│   ├── market.ts          # Player market & auctions
│   ├── shop.ts            # Shop purchases
│   ├── hut.ts             # Fishing hut passive income
│   ├── pets.ts            # Pet system & incubation
│   ├── steal.ts           # Steal mechanics
│   ├── buffs.ts           # Potion buff system
│   ├── events.ts          # Fishing event system
│   ├── achievements.ts    # Achievement tracking
│   └── rewards.ts         # Reward calculations
├── data/                  # Static game definitions
│   ├── fish.ts            # Fish species and rarities
│   ├── rods.ts            # Rod definitions
│   ├── baits.ts           # Bait definitions
│   ├── potions.ts         # Potion definitions
│   ├── pets.ts            # Pet definitions
│   ├── hut.ts             # Hut upgrade definitions
│   ├── achievements.ts    # Achievement definitions
│   ├── events.ts          # Event definitions
│   ├── quests.ts          # Quest definitions
│   ├── levels.ts          # Level progression thresholds
│   ├── junk.ts            # Junk item definitions
│   ├── sack.ts            # Sack tier definitions
│   └── types.ts           # Shared data types
├── db/                    # Database layer
│   ├── schema.ts          # Drizzle table definitions
│   ├── index.ts           # Database connection
│   └── redis.ts           # Redis client
├── ui/                    # Discord UI components
│   └── index.ts           # Embed and component builders
├── core/                  # Bot core
│   ├── Core.ts            # Client setup & dynamic loader
│   ├── Embed.ts           # Embed builder helpers
│   └── typings.ts         # Command & Event type definitions
├── events/                # Discord.js event handlers
│   ├── ReadyEvent.ts
│   ├── InteractionCreateEvent.ts
│   └── GuildCreateEvent.ts
├── config.ts              # Bot-wide constants
├── env.ts                 # Environment validation (Zod)
└── index.ts               # Entry point
```

---

## Database Schema

| Table              | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `fishing_profile`  | User stats, level, coins, streak           |
| `fishing_inventory`| User items (fish, rods, bait, potions)     |
| `fishing_log`      | Catch history                              |
| `hut`              | Player-owned fishing huts                  |
| `hut_inventory`    | Hut passive catch inventory                |
| `hut_notifications`| Hut collection reminders                   |
| `pet_instance`     | User pet instances                         |
| `egg_incubator`    | Eggs currently being incubated             |
| `market_listing`   | Market listings and auctions               |
| `achievement`      | User achievement progress                  |
| `leveling`         | Guild-specific leveling data               |
| `guild_settings`   | Per-guild bot configuration                |

---

## Architecture

- **Dynamic loading** -- commands (`src/commands/**/*Command.ts`) and events (`src/events/*Event.ts`) are auto-discovered via Bun's native Glob at startup. Drop a file in the right directory and it registers on restart.
- **Components V2** -- UI uses Discord.js buttons, selects, and modals for interactive flows.
- **Redis cooldowns** -- per-user command cooldowns and caching survive restarts and work across shards.
- **Event system** -- random fishing events with server-wide bonuses, announced to configured channels.
- **Drizzle ORM** -- type-safe PostgreSQL queries with full migration support.

---

## Development

| Script                     | Description                               |
| -------------------------- | ----------------------------------------- |
| `bun run dev`              | Start with hot reload                     |
| `bun run generate:command` | Interactive command scaffolder             |
| `bun run generate:event`   | Interactive event scaffolder              |
| `bun run db:generate`      | Generate Drizzle migration                |
| `bun run db:push`          | Push schema directly to DB (dev only)     |
| `bun run db:all`           | Generate + migrate + push in one step     |
| `bun run db:studio`        | Open Drizzle Studio browser               |

---

## Docker

Spin up the entire stack with Docker Compose:

```bash
docker compose up -d
docker compose logs -f bot
```

---

## Contributing

1. Fork the repo and create a branch (`git checkout -b feat/my-feature`)
2. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`)
3. Push and open a PR against `main`

---

## License

Distributed under the [Apache-2.0 License](LICENSE).
