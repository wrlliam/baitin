import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getActiveEvent } from "@/modules/fishing/events";
import { subtractCoins } from "@/modules/fishing/economy";
import { redis } from "@/db/redis";
import config from "@/config";
import { ApplicationCommandOptionType, ApplicationCommandType } from "discord.js";

const EFFECT_LABELS: Record<string, string> = {
  xp_multiplier: "XP Multiplier",
  catch_rate: "Catch Rate",
  rarity_boost: "Rarity Boost",
  coin_multiplier: "Coin Multiplier",
};

export default {
  name: "event",
  description: "Check or join the currently active fishing event.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/event", "/event join"],
  options: [
    {
      name: "join",
      description: "Join the current event (pays entry fee if required).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
    {
      name: "info",
      description: "Check the currently active fishing event.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
  ],
  run: async ({ args, ctx }) => {
    const sub = args.getSubcommand();

    const event = await getActiveEvent();

    if (!event) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🎪 Active Event")
          .text("*No event is currently active. Events trigger randomly — check back soon!*")
          .footer("Use /event info to check again anytime.")
          .build() as any,
      );
    }

    if (sub === "info") {
      const effectLines = event.effects.map((e) => {
        const label = EFFECT_LABELS[e.type] ?? e.type;
        const mult = e.value >= 1 ? `×${e.value}` : `×${e.value} (debuff)`;
        return `• **${label}:** ${mult}`;
      });

      const durationMins = Math.round(event.duration / 60000);
      const entryLine = event.entryFee ? `\n• **Entry Fee:** ${event.entryFee.toLocaleString()} ${config.emojis.coin}` : "";

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`🎪 ${event.name}`)
          .text(event.description)
          .divider()
          .text(
            `**Effects:**\n${effectLines.join("\n")}\n\n**Duration:** ${durationMins} minutes${entryLine}`,
          )
          .footer("Event effects apply automatically when you /cast during this event.")
          .build() as any,
      );
    }

    if (sub === "join") {
      if (!event.entryFee) {
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title("🎪 Free Event!")
            .body(`**${event.name}** is free to join — just use \`/cast\` and the event effects apply automatically!`)
            .build() as any,
        );
      }

      const joinKey = `event:joined:${event.id}:${ctx.user.id}`;
      const alreadyJoined = await redis.get(joinKey);

      if (alreadyJoined) {
        return ctx.editReply({
          content: `${config.emojis.cross} You've already joined **${event.name}**!`,
        });
      }

      const paid = await subtractCoins(ctx.user.id, event.entryFee);
      if (!paid) {
        return ctx.editReply({
          content: `${config.emojis.cross} You need **${event.entryFee.toLocaleString()}** ${config.emojis.coin} to join this event.`,
        });
      }

      const ttlSeconds = Math.max(1, Math.ceil(event.duration / 1000));
      await redis.set(joinKey, "1");
      await redis.send("EXPIRE", [joinKey, ttlSeconds.toString()]);

      const expirySeconds = Math.floor((Date.now() + event.duration) / 1000);

      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title(`🎪 Joined ${event.name}!`)
          .body(
            `Paid **${event.entryFee.toLocaleString()}** ${config.emojis.coin} entry fee.\nEvent ends <t:${expirySeconds}:R>.`,
          )
          .footer("Use /cast to fish with event effects active!")
          .build() as any,
      );
    }
  },
} as Command;
