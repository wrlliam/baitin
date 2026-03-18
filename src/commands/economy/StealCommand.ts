import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { attemptSteal } from "@/modules/fishing/steal";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "steal",
  description: "Attempt to steal from another player.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/steal <user>"],
  options: [
    {
      name: "user",
      description: "The player to steal from.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  run: async ({ args, client, ctx }) => {
    await ctx.deferReply();
    const target = args.getUser("user", true);

    if (target.id === ctx.user.id) {
      return ctx.editReply({
        content: `${config.emojis.cross} You can't steal from yourself!`,
      });
    }

    if (target.bot) {
      return ctx.editReply({
        content: `${config.emojis.cross} You can't steal from a bot!`,
      });
    }

    const result = await attemptSteal(ctx.user.id, target.id);

    if (result.success) {
      const description =
        result.type === "item"
          ? `You swiped **${result.itemEmoji} ${result.itemName}** from **${target.username}**!`
          : `You pocketed **${result.amount.toLocaleString()}** ${config.emojis.coin} from **${target.username}**!`;

      try {
        const targetUser = await client.users.fetch(target.id);
        await targetUser.send({
          content: `🚨 **${ctx.user.username}** stole ${result.type === "item" ? `your **${result.itemEmoji} ${result.itemName}**` : `**${result.amount.toLocaleString()}** ${config.emojis.coin}`} from you! You are immune from theft for the next 30 minutes.`,
        });
      } catch {}

      let achText = "";
      if (result.newAchievements && result.newAchievements.length > 0) {
        const lines = result.newAchievements
          .map((a) => `${a.emoji} **${a.name}** (+${a.coinReward}${config.emojis.coin})`)
          .join("\n");
        achText = `\n\n🏅 **Achievement Unlocked!**\n${lines}`;
      }

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🦹 Heist Successful!")
          .body(description + achText)
          .build() as any,
      );
    }

    if (result.error === "cooldown") {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("⏳ Still Cooling Down")
          .body(
            `You can't steal again until <t:${Math.floor(result.expiresAt / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    if (result.error === "target_immune") {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🛡️ Target is Immune")
          .body(
            `**${target.username}** is protected from theft until <t:${Math.floor(result.expiresAt / 1000)}:R>.`,
          )
          .build() as any,
      );
    }

    if (result.error === "level_diff") {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.cross} Honour Among Thieves`)
          .body(
            `**${target.username}** is too far below your level — stealing from them is forbidden.`,
          )
          .build() as any,
      );
    }

    if (result.error === "caught") {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🚔 Caught Red-Handed!")
          .body(
            `**${target.username}** caught you in the act! You were fined **${result.fine.toLocaleString()}** ${config.emojis.coin}.`,
          )
          .build() as any,
      );
    }

    if (result.error === "target_empty") {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("💸 Nothing to Steal")
          .body(
            `**${target.username}** doesn't have enough coins or items to steal from!`,
          )
          .build() as any,
      );
    }
  },
} as Command;
