import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { ApplicationCommandType   MessageFlags,
} from "discord.js";

export default {
  name: "serverinfo",
  description: "View information about this server.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/serverinfo"],
  options: [],
  run: async ({ ctx }) => {

    const guild = ctx.guild!;
    await guild.fetch();

    const created = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`;
    const createdAgo = `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`;
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount ?? 0;
    const textChannels = guild.channels.cache.filter((c) => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === 2).size;

    return ctx.editReply(
      ui()
        .color(config.colors.default)
        .title(`🏰 ${guild.name}`)
        .body(
          `**ID:** \`${guild.id}\`\n**Owner:** <@${guild.ownerId}>\n**Created:** ${created} (${createdAgo})`,
        )
        .divider()
        .body(
          `**Members:** ${guild.memberCount.toLocaleString()}\n**Text Channels:** ${textChannels}\n**Voice Channels:** ${voiceChannels}`,
        )
        .divider()
        .body(`**Boost Level:** ${boostLevel}\n**Boosts:** ${boostCount}`)
        .footer("Baitin • /help")
        .build() as any,
    );
  },
} as Command;
