import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import config from "@/config";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

export default {
  name: "settings",
  description: "Manage your fishing profile settings.",
  type: ApplicationCommandType.ChatInput,
  usage: [
    "/settings",
    "/settings leaderboard <show|hide>",
    "/settings hut-notifications <on|off>",
  ],
  defer: true,
  options: [
    {
      name: "leaderboard",
      description: "Show or hide yourself from the leaderboard.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "visibility",
          description: "Show or hide your profile on the leaderboard.",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: "Show me on the leaderboard", value: "show" },
            { name: "Hide me from the leaderboard", value: "hide" },
          ],
        },
      ],
    },
    {
      name: "hut-notifications",
      description: "Toggle hut collection DM notifications.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "state",
          description: "Turn DM notifications on or off.",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: "On — notify me when my hut is full", value: "on" },
            { name: "Off — no DM notifications", value: "off" },
          ],
        },
      ],
    },
    {
      name: "view",
      description: "View your current settings.",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  run: async ({ args, ctx }) => {
    const sub = args.getSubcommand();

    if (sub === "view") {
      const buildPanel = (p: Awaited<ReturnType<typeof getOrCreateProfile>>) =>
        ui()
          .color(config.colors.default)
          .title("⚙️ Your Settings")
          .divider()
          .section(
            `📊 **Leaderboard**\n${p.leaderboardHidden ? "Hidden — you won't appear on the leaderboard." : "Visible — your profile is shown on the leaderboard."}`,
            new ButtonBuilder()
              .setCustomId(`settings:toggle:leaderboard:${ctx.user.id}`)
              .setLabel(p.leaderboardHidden ? "👁️ Show Me" : "👁️ Hide Me")
              .setStyle(p.leaderboardHidden ? ButtonStyle.Success : ButtonStyle.Danger),
          )
          .divider()
          .section(
            `🏠 **Hut Notifications**\n${p.hutNotifications ? "On — you'll receive a DM when your hut is full." : "Off — no DM notifications for your hut."}`,
            new ButtonBuilder()
              .setCustomId(`settings:toggle:hutnotif:${ctx.user.id}`)
              .setLabel(p.hutNotifications ? "🔕 Turn Off" : "🔔 Turn On")
              .setStyle(p.hutNotifications ? ButtonStyle.Danger : ButtonStyle.Success),
          )
          .divider()
          .text(
            `🎪 **Event Announcements** — Controlled by server admins with \`/setup event-channel\``,
          )
          .footer("Click a button to toggle a setting.")
          .build();

      const profile = await getOrCreateProfile(ctx.user.id);
      const message = await ctx.editReply(buildPanel(profile) as any);

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === ctx.user.id,
        time: 5 * 60_000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === `settings:toggle:leaderboard:${ctx.user.id}`) {
          const current = await getOrCreateProfile(ctx.user.id);
          await db
            .update(fishingProfile)
            .set({ leaderboardHidden: !current.leaderboardHidden })
            .where(eq(fishingProfile.userId, ctx.user.id));
          const updated = await getOrCreateProfile(ctx.user.id);
          await i.update(buildPanel(updated) as any);
          return;
        }

        if (i.customId === `settings:toggle:hutnotif:${ctx.user.id}`) {
          const current = await getOrCreateProfile(ctx.user.id);
          await db
            .update(fishingProfile)
            .set({ hutNotifications: !current.hutNotifications })
            .where(eq(fishingProfile.userId, ctx.user.id));
          const updated = await getOrCreateProfile(ctx.user.id);
          await i.update(buildPanel(updated) as any);
          return;
        }
      });

      collector.on("end", async () => {
        try {
          await message.edit({ components: [] });
        } catch {}
      });

      return;
    }

    if (sub === "leaderboard") {
      const visibility = args.getString("visibility", true);
      const hidden = visibility === "hide";

      await db
        .update(fishingProfile)
        .set({ leaderboardHidden: hidden })
        .where(eq(fishingProfile.userId, ctx.user.id));

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("⚙️ Leaderboard Updated")
          .text(
            hidden
              ? "You are now **hidden** from the leaderboard."
              : "You are now **visible** on the leaderboard.",
          )
          .build() as any,
      );
    }

    if (sub === "hut-notifications") {
      const state = args.getString("state", true);
      const enabled = state === "on";

      await db
        .update(fishingProfile)
        .set({ hutNotifications: enabled })
        .where(eq(fishingProfile.userId, ctx.user.id));

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("⚙️ Hut Notifications Updated")
          .text(
            enabled
              ? "Hut notifications are now **on**. You'll receive a DM when your hut is full."
              : "Hut notifications are now **off**. No more DMs for your hut.",
          )
          .build() as any,
      );
    }
  },
} as Command;
