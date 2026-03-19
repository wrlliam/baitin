import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { giveRep } from "@/modules/fishing/social";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "rep",
  description: "Give a daily reputation point to another player.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/rep <user>"],
  options: [
    {
      name: "user",
      description: "Who to give rep to.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("user", true);

    if (target.id === ctx.user.id) {
      return ctx.editReply({
        content: `${config.emojis.cross} You can't rep yourself!`,
      });
    }
    if (target.bot) {
      return ctx.editReply({
        content: `${config.emojis.cross} You can't rep a bot!`,
      });
    }

    const result = await giveRep(ctx.user.id, target.id);

    if (!result.success) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("⏳ Already Repped")
          .body(result.error!)
          .build() as any,
      );
    }

    return ctx.editReply(
      ui()
        .color(config.colors.success)
        .title(`${config.emojis.rep} Rep Given!`)
        .body(
          `You gave **${target.username}** a reputation point!\n` +
          `They now have **${result.newRep}** ${config.emojis.rep} rep.`,
        )
        .build() as any,
    );
  },
} as Command;
