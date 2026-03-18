import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { fish as fishData } from "@/data/fish";
import { db } from "@/db";
import { fishingLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import config from "@/config";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
const RARITY_EMOJIS: Record<string, string> = {
  common: "○",
  uncommon: "◆",
  rare: "◆",
  epic: "❖",
  legendary: "✦",
  mythic: "✦✦",
};

const PAGE_SIZE = 10;

async function buildAlmanacPage(userId: string, page: number) {
  const logs = await db
    .select()
    .from(fishingLog)
    .where(and(eq(fishingLog.userId, userId), eq(fishingLog.itemType, "fish")));

  // Build caught map: fishId -> { count, firstCaught }
  const caughtMap = new Map<string, { count: number; firstCaught: Date }>();
  for (const log of logs) {
    const existing = caughtMap.get(log.itemId);
    const caughtAt = log.caughtAt ?? new Date();
    if (!existing) {
      caughtMap.set(log.itemId, { count: 1, firstCaught: caughtAt });
    } else {
      existing.count++;
      if (caughtAt < existing.firstCaught) existing.firstCaught = caughtAt;
    }
  }

  // Sort fish by rarity then by id
  const sorted = [...fishData].sort((a, b) => {
    const ri = RARITY_ORDER.indexOf(a.rarity as any);
    const rj = RARITY_ORDER.indexOf(b.rarity as any);
    if (ri !== rj) return ri - rj;
    return a.id.localeCompare(b.id);
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const caughtTotal = caughtMap.size;
  const totalFish = fishData.length;

  const lines = slice.map((f) => {
    const data = caughtMap.get(f.id);
    const raritySymbol = RARITY_EMOJIS[f.rarity] ?? "○";
    if (data) {
      const ts = `<t:${Math.floor(data.firstCaught.getTime() / 1000)}:d>`;
      return `${f.emoji} **${f.name}** ${raritySymbol} — ×${data.count} (first: ${ts})`;
    } else {
      return `🔲 *???* ${raritySymbol} — *${f.rarity}* — not yet caught`;
    }
  });

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`almanac:prev:${safePage}`)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`almanac:page`)
      .setLabel(`${safePage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`almanac:next:${safePage}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages - 1),
  );

  const embed = ui()
    .color(config.colors.default)
    .title("📖 Fish Almanac")
    .text(`**${caughtTotal}/${totalFish}** species discovered`)
    .divider()
    .text(lines.join("\n"))
    .footer(`Page ${safePage + 1}/${totalPages} • Catch more fish to complete your almanac!`);

  return { embed, navRow, page: safePage };
}

export default {
  name: "almanac",
  description: "View your fish almanac — track every species you've caught.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/almanac"],
  options: [],
  run: async ({ ctx }) => {
    await ctx.deferReply();

    let { embed, navRow, page } = await buildAlmanacPage(ctx.user.id, 0);

    const message = await ctx.editReply(
      embed.build({ rows: [navRow] }) as any,
    );

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (i.customId.startsWith("almanac:prev:")) {
        page = parseInt(i.customId.split(":")[2]) - 1;
      } else if (i.customId.startsWith("almanac:next:")) {
        page = parseInt(i.customId.split(":")[2]) + 1;
      } else {
        return i.deferUpdate();
      }

      const result = await buildAlmanacPage(ctx.user.id, page);
      page = result.page;
      await i.update(result.embed.build({ rows: [result.navRow] }) as any);
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
