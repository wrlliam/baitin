import { app } from "..";

import { Guild, GuildMember } from "discord.js";
import { z } from "zod";

export function createId(length: number = 35) {
  let str = "QWERTYUIOASDFGHJKLZXCVBNMqwertyuioasdfghjklzxcvbnm1234567890---";
  let chars = "";
  for (let i = 0; i < length; i++) {
    chars += str[Math.floor(Math.random() * str.length)];
  }
  return chars;
}

export function getCommand(name: string) {
  return app.commands.get(name.toLowerCase());
}

type VariableResolver = () => string | null | undefined;

export const variableFormat = async (
  content: string,
  guild: Guild | undefined,
  user: GuildMember | undefined,
): Promise<string> => {
  const now = new Date();

  const variables: Record<string, VariableResolver> = {
    "$user.username$": () => user?.user.username,
    "$user.displayname$": () => user?.displayName,
    "$user.nickname$": () => user?.nickname,
    "$user.id$": () => user?.id,
    "$user.tag$": () => user?.user.tag,
    "$user.discriminator$": () => user?.user.discriminator,
    "$user.mention$": () => (user ? `<@${user.id}>` : null),
    "$user.avatar$": () => user?.user.displayAvatarURL(),
    "$user.avatarurl$": () => user?.user.displayAvatarURL(),
    "$user.joindate$": () => user?.joinedAt?.toLocaleDateString(),
    "$user.joined$": () => user?.joinedAt?.toLocaleDateString(),
    "$user.createdate$": () => user?.user.createdAt.toLocaleDateString(),
    "$user.created$": () => user?.user.createdAt.toLocaleDateString(),
    "$user.roles$": () => user?.roles.cache.size.toString(),
    "$user.rolecount$": () => user?.roles.cache.size.toString(),
    "$user.bot$": () => (user?.user.bot ? "Yes" : "No"),

    "$guild.name$": () => guild?.name,
    "$guild.id$": () => guild?.id,
    "$guild.membercount$": () => guild?.memberCount.toString(),
    "$guild.members$": () => guild?.memberCount.toString(),
    "$guild.icon$": () => guild?.iconURL(),
    "$guild.iconurl$": () => guild?.iconURL(),
    "$guild.owner$": () => guild?.ownerId,
    "$guild.ownerid$": () => guild?.ownerId,
    "$guild.createdate$": () => guild?.createdAt.toLocaleDateString(),
    "$guild.created$": () => guild?.createdAt.toLocaleDateString(),
    "$guild.roles$": () => guild?.roles.cache.size.toString(),
    "$guild.rolecount$": () => guild?.roles.cache.size.toString(),
    "$guild.channels$": () => guild?.channels.cache.size.toString(),
    "$guild.channelcount$": () => guild?.channels.cache.size.toString(),
    "$guild.emojis$": () => guild?.emojis.cache.size.toString(),
    "$guild.emojicount$": () => guild?.emojis.cache.size.toString(),
    "$guild.boosts$": () => guild?.premiumSubscriptionCount?.toString() ?? "0",
    "$guild.boostcount$": () =>
      guild?.premiumSubscriptionCount?.toString() ?? "0",
    "$guild.boostlevel$": () => guild?.premiumTier.toString(),
    "$guild.boosttier$": () => guild?.premiumTier.toString(),

    "$time.now$": () => now.toISOString(),
    "$time.iso$": () => now.toISOString(),
    "$time.unix$": () => Math.floor(now.getTime() / 1000).toString(),
    "$time.date$": () => now.toLocaleDateString(),
    "$time.time$": () => now.toLocaleTimeString(),
    "$time.timestamp$": () => now.toLocaleString(),
    "$time.year$": () => now.getFullYear().toString(),
    "$time.month$": () => (now.getMonth() + 1).toString(),
    "$time.day$": () => now.getDate().toString(),
    "$time.hour$": () => now.getHours().toString(),
    "$time.minute$": () => now.getMinutes().toString(),
    "$time.second$": () => now.getSeconds().toString(),
  };

  let result = content;
  for (const [key, resolver] of Object.entries(variables)) {
    if (result.includes(key)) {
      try {
        const value = resolver();
        if (value !== null && value !== undefined) {
          result = result.replaceAll(key, value);
        }
      } catch {}
    }
  }

  return result;
};

export const createCustomVariableFormatter = async (
  customVariables: Record<string, VariableResolver>,
) => {
  return async (
    content: string,
    guild: Guild | undefined,
    user: GuildMember | undefined,
  ): Promise<string> => {
    let result = await variableFormat(content, guild, user);

    for (const [key, resolver] of Object.entries(customVariables)) {
      if (result.includes(key)) {
        try {
          const value = resolver();
          if (value !== null && value !== undefined) {
            result = result.replaceAll(key, value);
          }
        } catch {}
      }
    }

    return result;
  };
};

export const messagePayloadSchema = z.object({
  content: z.string().optional(),
  embeds: z.any().array().optional(),
});

export function limitSentence(str: string, length: number = 25) {
  return str.length > length ? str.slice(0, length) + "..." : str;
}

export function capitalise(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
