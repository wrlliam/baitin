import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { fish as fishData } from "@/data/fish";
import { db } from "@/db";
import { fishingLog } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import config from "@/config";
import type { ItemRarity } from "@/data/types";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

const RARITY_ORDER: ItemRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
];

const RARITY_LABELS: Record<ItemRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

const RARITY_EMOJIS: Record<ItemRarity, string> = {
  common: "<:common:1484338902876815391>",
  uncommon: "<:uncommon:1484338906764935268>",
  rare: "<:rare:1484338901534507280>",
  epic: "<:epic:1484338187844194405>",
  legendary: "<:legendary:1484338904915120171>",
  mythic: "<:mythic:1484338908979396789>",
};

const PAGE_SIZE = 10;

async function getCatchCounts(userId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      itemId: fishingLog.itemId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(fishingLog)
    .where(and(eq(fishingLog.userId, userId), eq(fishingLog.itemType, "fish")))
    .groupBy(fishingLog.itemId);

  return new Map(rows.map((r) => [r.itemId, r.count]));
}

function buildPage(
  username: string,
  rarity: ItemRarity,
  page: number,
  catchCounts: Map<string, number>,
) {
  const fishInTier = fishData.filter((f) => f.rarity === rarity);
  const caughtInTier = fishInTier.filter((f) => catchCounts.has(f.id));
  const totalCaught = [...catchCounts.values()].reduce((a, b) => a + b, 0);
  const totalUnique = catchCounts.size;
  const totalFish = fishData.length;

  const totalPages = Math.max(1, Math.ceil(fishInTier.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = fishInTier.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const lines = slice.map((f) => {
    const count = catchCounts.get(f.id);
    if (count) {
      return `${f.emoji} **${f.name}** — ×${count.toLocaleString()} caught`;
    }
    return `❓ **???** *(${f.name} not yet caught)*`;
  });

  // Rarity select menu
  const rarityMenu =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("col:rarity")
        .setPlaceholder("Select rarity...")
        .addOptions(
          RARITY_ORDER.map((r) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(RARITY_LABELS[r])
              .setValue(r)
              .setEmoji(RARITY_EMOJIS[r])
              .setDefault(r === rarity),
          ),
        ),
    );

  // Navigation buttons
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`col:prev`)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`col:pageinfo`)
      .setLabel(`${safePage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`col:next`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages - 1),
  );

  const titlePrefix = RARITY_EMOJIS[rarity];
  const embed = ui()
    .color(config.colors.default)
    .title(`${titlePrefix} ${username}'s Collection — ${RARITY_LABELS[rarity]}`)
    .text(
      `**${caughtInTier.length}/${fishInTier.length}** ${RARITY_LABELS[rarity].toLowerCase()} fish discovered  •  **${totalUnique}/${totalFish}** total unique  •  **${totalCaught.toLocaleString()}** total catches`,
    )
    .divider()
    .text(lines.join("\n"))
    .footer(
      `Use the menu to browse by rarity • Page ${safePage + 1}/${totalPages}`,
    );

  return {
    payload: embed.build({ rows: [rarityMenu, navRow] }),
    page: safePage,
  };
}

export default {
  name: "collection",
  description: "Browse your fish collection — every species you've caught.",
  type: ApplicationCommandType.ChatInput,
  usage: [
    "/collection",
    "/collection user:@someone",
    "/collection rarity:Rare",
  ],
  options: [
    {
      name: "user",
      description: "View another player's collection.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
    {
      name: "rarity",
      description: "Jump straight to a rarity tier.",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: RARITY_ORDER.map((r) => ({
        name: RARITY_LABELS[r],
        value: r,
      })),
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("user") ?? ctx.user;
    let rarity = (args.getString("rarity") as ItemRarity | null) ?? "common";
    let catchCounts = await getCatchCounts(target.id);

    let { payload, page } = buildPage(target.username, rarity, 0, catchCounts);
    const message = await ctx.editReply(payload as any);

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === ctx.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (i.isStringSelectMenu() && i.customId === "col:rarity") {
        rarity = i.values[0] as ItemRarity;
        page = 0;
        catchCounts = await getCatchCounts(target.id);
      } else if (i.isButton()) {
        if (i.customId === "col:prev") {
          page--;
        } else if (i.customId === "col:next") {
          page++;
        } else {
          return i.deferUpdate();
        }
      } else {
        return i.deferUpdate();
      }

      const result = buildPage(target.username, rarity, page, catchCounts);
      page = result.page;
      await i.update(result.payload as any);
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
