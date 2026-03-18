import config from "@/config";
import { ui, linkBtn } from "@/ui";
import { Command } from "@/core/typings";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

export default {
  name: "avatar",
  description: "Display a user's avatar.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/avatar", "/avatar [user]"],
  defer: "none",
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
    const member = ctx.guild?.members.cache.get(target.id);

    const globalAvatar = target.displayAvatarURL({ size: 1024, extension: "png" });
    const serverAvatar = member?.displayAvatarURL({ size: 1024, extension: "png" });
    const hasServerAvatar = serverAvatar && serverAvatar !== globalAvatar;

    const galleryItems = [{ url: globalAvatar, description: "Global Avatar" }];
    if (hasServerAvatar) {
      galleryItems.push({ url: serverAvatar, description: "Server Avatar" });
    }

    return ctx.reply(
      ui()
        .color(config.colors.default)
        .title(`🖼️ ${target.username}'s Avatar`)
        .gallery(galleryItems)
        .text(
          hasServerAvatar
            ? `Showing global and server avatar for **${target.username}**.`
            : `**${target.username}**'s avatar.`,
        )
        .footer("Baitin • /help")
        .build() as any,
    );
  },
} as Command;
