import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { db } from "@/db";
import { guildSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/utils/misc";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChannelType,
} from "discord.js";

export default {
  name: "setup",
  description: "Configure bot settings for this server.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/setup event-channel <channel>", "/setup event-channel-clear", "/setup view"],
  adminOnly: true,
  defer: true,
  options: [
    {
      name: "event-channel",
      description: "Set the channel for fishing event announcements.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "channel",
          description: "The text channel for event notifications.",
          type: ApplicationCommandOptionType.Channel,
          channelTypes: [ChannelType.GuildText],
          required: true,
        },
      ],
    },
    {
      name: "event-channel-clear",
      description: "Clear the event notification channel (disables event announcements).",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "view",
      description: "View current server settings.",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  run: async ({ args, ctx }) => {
    const sub = args.getSubcommand();
    const guildId = ctx.guildId!;

    if (sub === "view") {
      const rows = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId));
      const settings = rows[0];

      const channelText = settings?.eventNotificationChannelId
        ? `<#${settings.eventNotificationChannelId}>`
        : "Not set (events won't be announced)";

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("⚙️ Server Settings")
          .text(`🎪 **Event Channel:** ${channelText}`)
          .footer("Use /setup event-channel to configure")
          .build() as any,
      );
    }

    if (sub === "event-channel") {
      const channel = args.getChannel("channel", true);

      const existing = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId));
      if (existing[0]) {
        await db.update(guildSettings)
          .set({ eventNotificationChannelId: channel.id })
          .where(eq(guildSettings.guildId, guildId));
      } else {
        await db.insert(guildSettings).values({
          id: createId(),
          guildId,
          eventNotificationChannelId: channel.id,
        });
      }

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Event Channel Set`)
          .text(`Fishing event announcements will now be sent to <#${channel.id}>.`)
          .build() as any,
      );
    }

    if (sub === "event-channel-clear") {
      await db.update(guildSettings)
        .set({ eventNotificationChannelId: null })
        .where(eq(guildSettings.guildId, guildId));

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Event Channel Cleared`)
          .text("Event announcements have been disabled for this server.")
          .build() as any,
      );
    }
  },
} as Command;
