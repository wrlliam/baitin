import config from "@/config";
import { ui, linkBtn } from "@/ui";
import { Command } from "@/core/typings";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
} from "discord.js";

export default {
  name: "avatar",
  description: "Display a user's avatar.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/avatar", "/avatar [user]"],
  options: [
    {
      name: "user",
      description: "The user whose avatar to display.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("user") ?? ctx.user;
    const avatarUrl = target.displayAvatarURL({ size: 512, extension: "png" });

    const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      linkBtn("Open Full Size", avatarUrl),
    );

    return ctx.reply(
      ui()
        .color(config.colors.default)
        .title(`🖼️ ${target.username}'s Avatar`)
        .section(
          `**${target.username}**\nClick the button to open the full-size image.`,
          linkBtn("Open Full Size", avatarUrl),
        )
        .footer("Baitin • /help")
        .build() as any,
    );
  },
} as Command;
