import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  GuildMember,
} from "discord.js";

export default {
  name: "userinfo",
  description: "View information about a user.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/userinfo", "/userinfo [user]"],
  options: [
    {
      name: "user",
      description: "The user to look up.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],
  run: async ({ args, ctx }) => {
    await ctx.deferReply();

    const target = args.getUser("user") ?? ctx.user;
    const member = ctx.guild?.members.cache.get(target.id) as
      | GuildMember
      | undefined;

    const accountCreated = `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`;
    const accountAge = `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`;
    const joinedServer = member?.joinedTimestamp
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`
      : "Unknown";

    const roles =
      member?.roles.cache
        .filter((r) => r.id !== ctx.guild?.id)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 10)
        .join(", ") || "None";

    const badges: string[] = [];
    if (target.bot) badges.push("🤖 Bot");
    if (member?.permissions.has("Administrator")) badges.push("🛡️ Admin");
    if (member?.premiumSince) badges.push("💎 Server Booster");

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title(`👤 ${target.username}`)
        .body(
          `**ID:** \`${target.id}\`\n**Account Created:** ${accountCreated} (${accountAge})\n**Joined Server:** ${joinedServer}`,
        )
        .divider()
        .body(
          `**Roles (${member?.roles.cache.size ? member.roles.cache.size - 1 : 0})**\n${roles}`,
        )
        .footer("Baitin • /help")
        .build() as any,
    );
  },
} as Command;
