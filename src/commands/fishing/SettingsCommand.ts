import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { db } from "@/db";
import { fishingProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import config from "@/config";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
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
      const profile = await getOrCreateProfile(ctx.user.id);
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("⚙️ Your Settings")
          .divider()
          .text(
            `📊 **Leaderboard** — ${profile.leaderboardHidden ? "Hidden — you won't appear on the leaderboard." : "Visible — your profile is shown on the leaderboard."}\n` +
            `🏠 **Hut Notifications** — ${profile.hutNotifications ? "On — you'll receive a DM when your hut is full." : "Off — no DM notifications for your hut."}`,
          )
          .divider()
          .text(`🎪 **Event Announcements** — Controlled by server admins with \`/setup event-channel\``)
          .footer("Use /settings <option> to change a setting.")
          .build() as any,
      );
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
