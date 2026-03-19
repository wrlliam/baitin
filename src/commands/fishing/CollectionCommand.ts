import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { fish as allFish } from "@/data/fish";
import { db } from "@/db";
import { fishingLog } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  User,
} from "discord.js";
import type { ItemRarity } from "@/data/types";

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
  common: "⬜",
  uncommon: "🟩",
  rare: "🟦",
  epic: "🟪",
  legendary: "🟧",
  mythic: "🌟",
};

async function getCatchCounts(
  userId: string,
): Promise<Map<string, number>> {
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

function buildCollectionPage(
  target: User,
  rarity: ItemRarity,
  catchCounts: Map<string, number>,
) {
  const fishInTier = allFish.filter((f) => f.rarity === rarity);
  const caughtInTier = fishInTier.filter((f) => catchCounts.has(f.id));
  const totalCaught = [...catchCounts.values()].reduce((a, b) => a + b, 0);
  const totalUnique = catchCounts.size;
  const totalFish = allFish.length;

  const lines = fishInTier.map((f) => {
    const count = catchCounts.get(f.id);
    if (count) {
      return `${f.emoji} **${f.name}** — ×${count.toLocaleString()} caught`;
    }
    return `❓ **???** *(${f.name} not yet caught)*`;
  });

  // Row 1: common / uncommon / rare / epic / legendary
  // Row 2: mythic (only 5 buttons per row allowed)
  const tierRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    (["common", "uncommon", "rare", "epic", "legendary"] as ItemRarity[]).map(
      (r) =>
        new ButtonBuilder()
          .setCustomId(`col:tab:${r}`)
          .setLabel(RARITY_LABELS[r])
          .setEmoji(RARITY_EMOJIS[r])
          .setStyle(r === rarity ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );
  const tierRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`col:tab:mythic`)
      .setLabel("Mythic")
      .setEmoji(RARITY_EMOJIS.mythic)
      .setStyle(rarity === "mythic" ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const titlePrefix = RARITY_EMOJIS[rarity];

  const page = ui()
    .color(config.colors.default)
    .title(`${titlePrefix} ${target.username}'s Collection — ${RARITY_LABELS[rarity]}`)
    .body(
      `**${caughtInTier.length}/${fishInTier.length}** ${RARITY_LABELS[rarity].toLowerCase()} fish discovered  •  **${totalUnique}/${totalFish}** total unique catches  •  **${totalCaught.toLocaleString()}** total casts`,
    )
    .divider()
    .body(lines.join("\n"))
    .footer(`Use the buttons below to browse by rarity`);

  return page.build({ rows: [tierRow1, tierRow2] });
}

export default {
  name: "collection",
  description: "Browse your fish collection — all species ever caught.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/collection", "/collection user:@someone"],
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
    const initialRarity = (args.getString("rarity") as ItemRarity | null) ?? "common";

    const catchCounts = await getCatchCounts(target.id);

    const payload = buildCollectionPage(target, initialRarity, catchCounts);
    const message = await ctx.editReply(payload as any);

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === ctx.user.id,
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (!i.customId.startsWith("col:tab:")) return i.deferUpdate();
      const rarity = i.customId.replace("col:tab:", "") as ItemRarity;
      const fresh = await getCatchCounts(target.id);
      return i.update(buildCollectionPage(target, rarity, fresh) as any);
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
