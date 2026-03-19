import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { placeBounty, getActiveBounties } from "@/modules/fishing/bounty";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "bounty",
  description: "Place bounties on players or view the bounty board.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/bounty place <user> <amount>", "/bounty board"],
  options: [
    {
      name: "place",
      description: "Place a bounty on a player.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Who to place a bounty on.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "amount",
          description: "Bounty amount (500-50,000 coins).",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 500,
          maxValue: 50000,
        },
      ],
    },
    {
      name: "board",
      description: "View active bounties.",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  run: async ({ args, ctx, client }) => {
    const sub = args.getSubcommand();

    if (sub === "place") {
      const target = args.getUser("user", true);
      const amount = args.getInteger("amount", true);

      if (target.id === ctx.user.id) {
        return ctx.editReply({
          content: `${config.emojis.cross} You can't bounty yourself!`,
        });
      }
      if (target.bot) {
        return ctx.editReply({
          content: `${config.emojis.cross} You can't bounty a bot!`,
        });
      }

      await getOrCreateProfile(target.id);

      const result = await placeBounty(ctx.user.id, target.id, amount);

      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title(`${config.emojis.bounty} Bounty Placed!`)
          .body(
            `You placed a **${amount.toLocaleString()}** ${config.emojis.coin} bounty on **${target.username}**!\n\n` +
            `Anyone who successfully steals from them will collect the bounty.\n` +
            `-# Bounty expires in 72 hours. Coins refunded if unclaimed.`,
          )
          .build() as any,
      );
    }

    if (sub === "board") {
      const bounties = await getActiveBounties(10);

      if (bounties.length === 0) {
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.bounty} Bounty Board`)
            .body("No active bounties right now. Use `/bounty place` to set one!")
            .build() as any,
        );
      }

      // Group bounties by target
      const byTarget = new Map<string, number>();
      for (const b of bounties) {
        byTarget.set(b.targetId, (byTarget.get(b.targetId) ?? 0) + b.amount);
      }

      const lines = await Promise.all(
        [...byTarget.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(async ([targetId, total]) => {
            const user = await client.users.fetch(targetId).catch(() => null);
            const name = user?.username ?? "Unknown";
            const count = bounties.filter((b) => b.targetId === targetId).length;
            return `${config.emojis.bounty} **${name}** — **${total.toLocaleString()}** ${config.emojis.coin} (${count} bounty${count > 1 ? "ies" : ""})`;
          }),
      );

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.bounty} Bounty Board`)
          .body(lines.join("\n"))
          .footer("Steal from a target to claim their bounties!")
          .build() as any,
      );
    }
  },
} as Command;
