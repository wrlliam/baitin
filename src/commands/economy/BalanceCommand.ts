import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { getInventory } from "@/modules/fishing/inventory";
import { allItems } from "@/data";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "balance",
  description: "Check your or another player's coin balance.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/balance", "/balance [user]"],
  options: [
    {
      name: "user",
      description: "The user to check.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("user") ?? ctx.user;
    const profile = await getOrCreateProfile(target.id);

    // Calculate inventory value
    const inventory = await getInventory(target.id);
    const inventoryValue = inventory.reduce((sum, row) => {
      const item = allItems.get(row.itemId);
      if (!item) return sum;
      return sum + Math.floor(item.price * config.fishing.sellPriceMultiplier * row.quantity);
    }, 0);

    const netWorth = profile.coins + inventoryValue;
    const isSelf = target.id === ctx.user.id;

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .section(
          `**${target.username}'s Balance**`,
          ui.thumb(target.displayAvatarURL({ extension: "png", size: 128 })),
        )
        .divider()
        .text(
          `${config.emojis.coin} **Wallet** — ${profile.coins.toLocaleString()} coins\n` +
          `${config.emojis.gem} **Gems** — ${profile.gems.toLocaleString()}\n` +
          `📦 **Inventory Value** — ~${inventoryValue.toLocaleString()} coins\n` +
          `💰 **Net Worth** — ~${netWorth.toLocaleString()} coins`,
        )
        .footer(isSelf ? "Earn coins with /cast, /daily, /work, and more!" : `Baitin • /help`)
        .build() as any,
    );
  },
} as Command;
