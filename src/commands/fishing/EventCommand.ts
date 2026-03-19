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

const EFFECT_EMOJIS: Record<string, string> = {
  xp_multiplier: "📖",
  catch_rate: "🎣",
  rarity_boost: "✨",
  coin_multiplier: "💰",
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
          .title(`${config.emojis.event} Active Event`)
          .text("*No event is currently active.*")
          .divider()
          .text("Events trigger randomly every few hours. Check back soon!")
          .footer("Use /event info to check again anytime.")
          .build() as any,
      );
    }

    if (sub === "info") {
      const durationMins = Math.round(event.duration / 60000);

      const effectLines = event.effects.map((e) => {
        const label = EFFECT_LABELS[e.type] ?? e.type;
        const emoji = EFFECT_EMOJIS[e.type] ?? "•";
        const isDebuff = e.value < 1;
        const display = isDebuff ? `×${e.value} ⬇` : `×${e.value}`;
        return `${emoji} **${label}:** ${display}`;
      });

      const builder = ui()
        .color(0x2b7fff)
        .title(`${config.emojis.event} ${event.name}`)
        .text(event.description)
        .divider()
        .text(effectLines.join("\n"));

      const detailLines: string[] = [];
      detailLines.push(`⏱️ **Duration:** ${durationMins} minutes`);
      if (event.entryFee) {
        detailLines.push(`${config.emojis.coin} **Entry Fee:** ${event.entryFee.toLocaleString()}`);
      } else {
        detailLines.push("🆓 **Entry:** Free — effects apply automatically");
      }

      builder.divider();
      builder.text(detailLines.join("\n"));
      builder.footer("Event effects apply when you /cast • Use /event join if an entry fee is required");

      return ctx.editReply(builder.build() as any);
    }

    if (sub === "join") {
      if (!event.entryFee) {
        return ctx.editReply(
          ui()
            .color(config.colors.success)
            .title(`🆓 ${event.name}`)
            .text("This event is **free** — just use `/cast` and the effects apply automatically!")
            .divider()
            .text(
              event.effects
                .map((e) => `${EFFECT_EMOJIS[e.type] ?? "•"} **${EFFECT_LABELS[e.type] ?? e.type}:** ×${e.value}`)
                .join("\n"),
            )
            .footer("Go fish!")
            .build() as any,
        );
      }

      const joinKey = `event:joined:${event.id}:${ctx.user.id}`;
      const alreadyJoined = await redis.get(joinKey);

      if (alreadyJoined) {
        return ctx.editReply(
          ui()
            .color(config.colors.warn)
            .title(`${config.emojis.event} Already Joined`)
            .text(`You've already joined **${event.name}**! Get out there and fish.`)
            .footer("Use /cast to fish with event effects active")
            .build() as any,
        );
      }

      const paid = await subtractCoins(ctx.user.id, event.entryFee);
      if (!paid) {
        return ctx.editReply(
          ui()
            .color(config.colors.error)
            .title(`${config.emojis.cross} Not Enough Coins`)
            .text(`You need **${event.entryFee.toLocaleString()}** ${config.emojis.coin} to join **${event.name}**.`)
            .build() as any,
        );
      }

      const ttlSeconds = Math.max(1, Math.ceil(event.duration / 1000));
      await redis.set(joinKey, "1");
      await redis.send("EXPIRE", [joinKey, ttlSeconds.toString()]);

      const expirySeconds = Math.floor((Date.now() + event.duration) / 1000);

      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title(`${config.emojis.tick} Joined ${event.name}!`)
          .text(`Paid **${event.entryFee.toLocaleString()}** ${config.emojis.coin} entry fee.`)
          .divider()
          .text(
            event.effects
              .map((e) => `${EFFECT_EMOJIS[e.type] ?? "•"} **${EFFECT_LABELS[e.type] ?? e.type}:** ×${e.value}`)
              .join("\n"),
          )
          .divider()
          .text(`⏳ Event ends <t:${expirySeconds}:R>`)
          .footer("Use /cast to fish with event effects active!")
          .build() as any,
      );
    }
  },
} as Command;
