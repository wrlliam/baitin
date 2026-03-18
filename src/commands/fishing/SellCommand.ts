import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { allItems } from "@/data";
import { getInventory, sellItem, sellAll } from "@/modules/fishing/inventory";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

const SELL_ALL_REACTIONS = ["💰", "🤑", "🎉", "🪙", "💸"];

function pickReaction() {
  return SELL_ALL_REACTIONS[
    Math.floor(Math.random() * SELL_ALL_REACTIONS.length)
  ];
}

export default {
  name: "sell",
  description: "Sell items from your sack.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/sell item <name> [qty]", "/sell all"],
  options: [
    {
      name: "item",
      description: "Sell a specific item.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "name",
          description: "The item to sell.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "quantity",
          description: "How many to sell (default: all).",
          type: ApplicationCommandOptionType.Integer,
          required: false,
          minValue: 1,
        },
      ],
    },
    {
      name: "all",
      description:
        "Sell all fish, junk, and bait (keeps rods, pets, eggs, potions).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
  ],
  autocomplete: async ({ ctx }) => {
    const focused = ctx.options.getFocused(true);
    const inventory = await getInventory(ctx.user.id);
    const sellable = inventory.filter(
      (i) => !["rod", "pet", "egg"].includes(i.itemType),
    );

    return ctx.respond(
      sellable
        .map((i) => {
          const item = allItems.get(i.itemId);
          return item
            ? {
                name: `${item.name} ×${i.quantity} (${item.price} coins each)`,
                value: i.itemId,
              }
            : null;
        })
        .filter(Boolean)
        .filter((c) =>
          c!.name
            .toLowerCase()
            .includes((focused.value as string).toLowerCase()),
        )
        .slice(0, 25) as { name: string; value: string }[],
    );
  },
  run: async ({ args, client, ctx }) => {
    await ctx.deferReply();
    const sub = args.getSubcommand();

    if (sub === "all") {
      const inventory = await getInventory(ctx.user.id);
      const sellable = inventory.filter(
        (i) => !["rod", "pet", "egg", "misc"].includes(i.itemType),
      );

      const result = await sellAll(ctx.user.id);
      if (result.itemCount === 0) {
        return ctx.editReply({
          content: `${config.emojis.cross} Nothing to sell! Your sack only has gear — head out and catch something first.`,
        });
      }

      const fishCount = sellable
        .filter((i) => i.itemType === "fish")
        .reduce((s, i) => s + i.quantity, 0);
      const junkCount = sellable
        .filter((i) => i.itemType === "junk")
        .reduce((s, i) => s + i.quantity, 0);
      const baitCount = sellable
        .filter((i) => i.itemType === "bait")
        .reduce((s, i) => s + i.quantity, 0);

      const breakdownLines: string[] = [];
      if (fishCount > 0) breakdownLines.push(`🐟 **${fishCount}** fish`);
      if (junkCount > 0) breakdownLines.push(`🗑️ **${junkCount}** junk`);
      if (baitCount > 0) breakdownLines.push(`🪱 **${baitCount}** bait`);

      const reaction = pickReaction();

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${reaction} Sold Everything!`)
          .body(
            `${breakdownLines.join(" • ")}\n\n> Pocketed **${result.totalCoins.toLocaleString()}** ${config.emojis.coin}!`,
          )
          .build() as any,
      );
    }

    if (sub === "item") {
      const itemId = args.getString("name", true);
      const item = allItems.get(itemId);
      if (!item)
        return ctx.editReply({
          content: `${config.emojis.cross} Unknown item.`,
        });

      const inventory = await getInventory(ctx.user.id);
      const owned = inventory.find((i) => i.itemId === itemId);
      if (!owned)
        return ctx.editReply({
          content: `${config.emojis.cross} You don't have that item in your sack.`,
        });

      const qty = args.getInteger("quantity") ?? owned.quantity;
      const result = await sellItem(ctx.user.id, itemId, qty);

      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      const qtyLabel = qty > 1 ? `${qty}× ` : "";

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Sold!`)
          .body(
            `${item.emoji} **${qtyLabel}${item.name}** → **${result.coinsGained!.toLocaleString()}** ${config.emojis.coin}`,
          )
          .build() as any,
      );
    }
  },
} as Command;
