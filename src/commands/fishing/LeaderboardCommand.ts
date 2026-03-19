import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

const MEDALS = ["\u{1F947}", "\u{1F948}", "\u{1F949}", "4\uFE0F\u20E3", "5\uFE0F\u20E3"];

type BoardType = "coins" | "level" | "catches" | "streaks";

const BOARD_CONFIG: Record<BoardType, { emoji: string; label: string; title: string }> = {
  coins: { emoji: "\u{1F4B0}", label: "Coins", title: "\u{1F4B0} Top Coins" },
  level: { emoji: "\u{1F3A3}", label: "Level", title: "\u{1F3A3} Top Level" },
  catches: { emoji: "\u{1F41F}", label: "Catches", title: "\u{1F41F} Top Catches" },
  streaks: { emoji: "\u{1F525}", label: "Streaks", title: "\u{1F525} Top Streaks" },
};

const BOARD_ORDER: BoardType[] = ["coins", "level", "catches", "streaks"];

async function fetchTop10(type: BoardType) {
  const sortCol =
    type === "coins"
      ? fishingProfile.coins
      : type === "level"
        ? fishingProfile.level
        : type === "streaks"
          ? fishingProfile.currentStreak
          : fishingProfile.totalCatches;

  return db
    .select()
    .from(fishingProfile)
    .where(eq(fishingProfile.leaderboardHidden, false))
    .orderBy(desc(sortCol))
    .limit(10);
}

function formatValue(type: BoardType, row: any): string {
  if (type === "coins") return `${row.coins.toLocaleString()} ${config.emojis.coin}`;
  if (type === "level") return `Level ${row.level}`;
  if (type === "streaks") return `${row.currentStreak} day streak`;
  return `${row.totalCatches.toLocaleString()} catches`;
}

function buildBoardPayload(
  type: BoardType,
  rows: any[],
  usernames: Map<string, string>,
  callerId: string,
  callerRank: number | null,
) {
  const cfg = BOARD_CONFIG[type];

  const lines = rows.map((row, i) => {
    const medal = MEDALS[i] ?? `**${i + 1}.**`;
    const name = usernames.get(row.userId) ?? "Unknown";
    const val = formatValue(type, row);
    const highlight = row.userId === callerId ? " **\u25C0**" : "";
    return `${medal} **${name}** \u2014 ${val}${highlight}`;
  });

  const builder = ui()
    .color(config.colors.default)
    .title(`\u{1F3C6} ${cfg.title}`);

  if (lines.length === 0) {
    builder.text("*No players on the leaderboard yet.*");
  } else {
    builder.text(lines.join("\n"));
  }

  if (callerRank !== null && callerRank >= 10) {
    builder.divider().text(`Your rank: **#${callerRank + 1}**`);
  }

  builder.footer("Baitin \u2022 Use buttons to switch boards");

  return builder.build({ rows: [buildNavRow(type)] });
}

function buildNavRow(active: BoardType): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    BOARD_ORDER.map((type) =>
      new ButtonBuilder()
        .setCustomId(`lb:${type}`)
        .setLabel(`${BOARD_CONFIG[type].emoji} ${BOARD_CONFIG[type].label}`)
        .setStyle(type === active ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );
}

export default {
  name: "leaderboard",
  description: "View the top players for coins, level, and catches.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/leaderboard"],
  options: [],
  run: async ({ client, ctx }) => {

    const usernameCache = new Map<string, string>();
    const fetchUser = async (id: string) => {
      if (usernameCache.has(id)) return usernameCache.get(id)!;
      try {
        const u = await client.users.fetch(id);
        usernameCache.set(id, u.username);
        return u.username;
      } catch {
        usernameCache.set(id, "Unknown");
        return "Unknown";
      }
    };

    // Pre-fetch all boards and caller ranks in parallel
    const [coinsRows, levelRows, catchRows, streakRows, allProfiles] = await Promise.all([
      fetchTop10("coins"),
      fetchTop10("level"),
      fetchTop10("catches"),
      fetchTop10("streaks"),
      db
        .select({ userId: fishingProfile.userId, coins: fishingProfile.coins, level: fishingProfile.level, totalCatches: fishingProfile.totalCatches, currentStreak: fishingProfile.currentStreak })
        .from(fishingProfile)
        .where(eq(fishingProfile.leaderboardHidden, false)),
    ]);

    const boardData: Record<BoardType, any[]> = { coins: coinsRows, level: levelRows, catches: catchRows, streaks: streakRows };

    // Compute caller rank for each board
    const callerRanks: Record<BoardType, number | null> = { coins: null, level: null, catches: null, streaks: null };
    for (const type of BOARD_ORDER) {
      const inTop = boardData[type].some((r) => r.userId === ctx.user.id);
      if (!inTop) {
        const key = type === "coins" ? "coins" : type === "level" ? "level" : type === "streaks" ? "currentStreak" : "totalCatches";
        const sorted = allProfiles.slice().sort((a: any, b: any) => b[key] - a[key]);
        const idx = sorted.findIndex((r) => r.userId === ctx.user.id);
        if (idx !== -1) callerRanks[type] = idx;
      }
    }

    // Pre-fetch all usernames
    const allUserIds = new Set([...coinsRows, ...levelRows, ...catchRows, ...streakRows].map((r) => r.userId));
    await Promise.all([...allUserIds].map(fetchUser));

    let activeBoard: BoardType = "coins";

    const message = await ctx.editReply(
      buildBoardPayload(activeBoard, boardData[activeBoard], usernameCache, ctx.user.id, callerRanks[activeBoard]) as any,
    );

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 2 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (!i.customId.startsWith("lb:")) return i.deferUpdate();

      activeBoard = i.customId.replace("lb:", "") as BoardType;

      // Fetch usernames for this board if not cached
      for (const row of boardData[activeBoard]) {
        if (!usernameCache.has(row.userId)) await fetchUser(row.userId);
      }

      await i.update(
        buildBoardPayload(activeBoard, boardData[activeBoard], usernameCache, ctx.user.id, callerRanks[activeBoard]) as any,
      );
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
