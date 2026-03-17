# 🤖 djs-template

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-FF4438?style=for-the-badge&logo=redis&logoColor=white)
![DrizzleORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)

A production-ready Discord bot template built with TypeScript, featuring dynamic loading, persistent storage, and a developer-friendly generator CLI.

</div>

---

## ✨ Features

- **Dynamic command & event loading** — Drop files in the right folder and they're automatically registered. No manual imports.
- **Interactive generators** — Scaffold new commands and events from the CLI with searchable prompts, type inference, and generated boilerplate.
- **Drizzle ORM** — Type-safe database access with migrations and a schema-first workflow.
- **Redis** — Built-in caching and ephemeral data storage out of the box.
- **Docker support** — Fully containerised with `docker-compose` for bot, database, and Redis together.
- **Pre-defined commands** — A set of ready-to-use commands to get you started immediately.

---

## 📋 Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://docker.com) & Docker Compose (optional, for containerised setup)
- A Discord application & bot token from the [Discord Developer Portal](https://discord.com/developers/applications)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/djs-template.git
cd djs-template
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Then fill in your `.env`:

```env
# Bot
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_dev_guild_id_here   # Optional: for guild-scoped command registration

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/djs_template

# Redis
REDIS_URL=redis://localhost:6379
```

### 4. Run database migrations

```bash
bun run db:migrate
```

### 5. Start the bot

```bash
# Development (with hot reload)
bun run dev

# Production
bun run start
```

---

## 🐳 Docker Setup

The easiest way to run the full stack (bot + PostgreSQL + Redis) is with Docker Compose:

```bash
docker-compose up -d
```

This will spin up:

| Service    | Port |
| ---------- | ---- |
| Bot        | —    |
| PostgreSQL | 5432 |
| Redis      | 6379 |

To view logs:

```bash
docker-compose logs -f bot
```

To stop:

```bash
docker-compose down
```

---

## 📁 Project Structure

```
.
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
├── env.example
├── package.json
├── tsconfig.json
│
├── scripts/
│   ├── generate-command.ts   # Interactive command scaffolder
│   └── generate-event.ts     # Interactive event scaffolder
│
└── src/
    ├── index.ts               # Entry point
    ├── config.ts              # Bot configuration
    ├── env.ts                 # Environment variable parsing & validation
    │
    ├── commands/              # Command files, grouped by category
    │   └── misc/
    │       ├── EchoCommand.ts
    │       └── HelpCommand.ts
    │
    ├── events/                # Top-level Discord event listeners
    │   ├── InteractionCreateEvent.ts
    │   └── ReadyEvent.ts
    │
    ├── listeners/             # Additional event listener logic
    │   └── index.ts
    │
    ├── core/
    │   ├── Core.ts            # Client setup & dynamic loader
    │   ├── Embed.ts           # Reusable embed builder
    │   └── typings.ts         # Shared types (Command, Event, etc.)
    │
    ├── db/
    │   ├── index.ts           # Drizzle database client
    │   ├── redis.ts           # Redis client
    │   └── schema.ts          # Drizzle schema definitions
    │
    ├── modules/               # Self-contained feature modules
    │   ├── index.ts
    │   └── management/
    │       └── logging.ts
    │
    └── utils/
        ├── index.ts
        ├── logger.ts          # Logging utility
        ├── misc.ts            # General helpers
        ├── pagination.ts      # Paginated embed utility
        └── permissions.ts     # Permission helpers
```

---

## ⚡ Generators

Instead of writing boilerplate by hand, use the built-in generator scripts to scaffold new commands and events.

### Generate a command

```bash
bun run generate:command
```

The CLI will walk you through:

- Command name, description, type, category, and usage
- Adding typed options (String, Integer, Boolean, User, Channel, etc.)
- Confirming the output path before writing

### Generate an event

```bash
bun run generate:event
```

The CLI will:

- Let you search across all ~90 Discord.js client events
- Show the correct argument types for the selected event
- Generate a fully typed event file, including the correct `discord.js` imports

Both generators are **self-contained** and do not import from `src/`, so they will never accidentally start the bot.

---

## 🔧 Adding Commands Manually

Create a file in `src/commands/<category>/`:

```ts
// src/commands/general/HelloCommand.ts
import { Command } from "@/core/typings";
import { ApplicationCommandType } from "discord.js";

export default {
  name: "hello",
  description: "Says hello!",
  type: ApplicationCommandType.ChatInput,
  usage: ["/hello"],
  options: [],
  run: async ({ ctx }) => {
    await ctx.reply("Hello, world!");
  },
} as Command;
```

The loader will pick it up automatically on next start — no registration needed.

---

## 🎧 Adding Events Manually

Create a file in `src/events/`:

```ts
// src/events/GuildMemberAddEvent.ts
import { Event } from "@/core/typings";
import { ClientEvents, GuildMember } from "discord.js";

export default {
  name: "guildMemberAdd",
  run: async (member: GuildMember) => {
    console.log(`${member.user.tag} joined ${member.guild.name}`);
  },
} as Event<keyof ClientEvents>;
```

---

## 🗄️ Database

This template uses [Drizzle ORM](https://orm.drizzle.team) for database access.

```bash
# Generate a migration after schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Open Drizzle Studio (visual DB browser)
bun run db:studio
```

Define your schema in `src/db/schema.ts`:

```ts
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});
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
| `bun run db:push`       | Run database push                     |
| `bun run db:studio`        | Open Drizzle Studio                       |

---

## 📄 License

[MIT](LICENSE)
