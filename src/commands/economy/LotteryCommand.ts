import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  getOrCreateCurrentDraw,
  buyTickets,
  drawLottery,
  TICKET_PRICE,
  MAX_TICKETS_PER_DRAW,
} from "@/modules/fishing/lottery";
import { incrementQuestProgress } from "@/modules/fishing/quests";
import { db } from "@/db";
import { lotteryDraw, lotteryTicket } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "lottery",
  description: "Buy lottery tickets and win the jackpot!",
  type: ApplicationCommandType.ChatInput,
  usage: ["/lottery buy <tickets>", "/lottery status", "/lottery history"],
  options: [
    {
      name: "buy",
      description: "Buy lottery tickets for the current draw.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "tickets",
          description: `How many tickets to buy (1-${MAX_TICKETS_PER_DRAW}, ${TICKET_PRICE} coins each).`,
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
          maxValue: MAX_TICKETS_PER_DRAW,
        },
      ],
    },
    {
      name: "status",
      description: "View the current lottery draw status.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "history",
      description: "View recent lottery winners.",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  run: async ({ args, ctx, client }) => {
    const sub = args.getSubcommand();

    // Lazy draw check — trigger if needed
    const { draw, shouldDraw } = await getOrCreateCurrentDraw();

    if (shouldDraw) {
      const result = await drawLottery(draw.id);
      if (result) {
        const winner = await client.users.fetch(result.winnerId).catch(() => null);
        const winnerName = winner?.username ?? "Unknown";

        await ctx.editReply(
          ui()
            .color(config.colors.success)
            .title(`${config.emojis.lottery} Lottery Drawn!`)
            .body(
              `The lottery has been drawn!\n\n` +
              `${config.emojis.crown} **${winnerName}** won the jackpot of **${result.pot.toLocaleString()}** ${config.emojis.coin}!\n\n` +
              `-# A new draw has started. Use \`/lottery buy\` to enter!`,
            )
            .build() as any,
        );

        // The current draw is now completed; fetch new draw for subsequent commands
        return;
      }
    }

    if (sub === "buy") {
      const count = args.getInteger("tickets", true);

      // Refetch draw in case it was just completed
      const { draw: currentDraw } = await getOrCreateCurrentDraw();

      const result = await buyTickets(ctx.user.id, count, currentDraw.id);

      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      const cost = count * TICKET_PRICE;
      void incrementQuestProgress(ctx.user.id, "buy_lottery", undefined, count);

      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title(`${config.emojis.lottery} Tickets Purchased!`)
          .body(
            `You bought **${count}** ticket(s) for **${cost.toLocaleString()}** ${config.emojis.coin}.\n` +
            `You now have **${result.totalTickets}/${MAX_TICKETS_PER_DRAW}** tickets for this draw.\n\n` +
            `Current pot: **${(currentDraw.totalPot + cost).toLocaleString()}** ${config.emojis.coin}\n` +
            `Draw: <t:${Math.floor(currentDraw.drawAt.getTime() / 1000)}:R>`,
          )
          .build() as any,
      );
    }

    if (sub === "status") {
      // Get user's tickets for this draw
      const [userTicket] = await db
        .select()
        .from(lotteryTicket)
        .where(and(eq(lotteryTicket.drawId, draw.id), eq(lotteryTicket.userId, ctx.user.id)))
        .limit(1);

      const yourTickets = userTicket?.ticketCount ?? 0;

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.lottery} Current Lottery`)
          .body(
            `${config.emojis.coin} **Pot:** ${draw.totalPot.toLocaleString()} coins\n` +
            `🎟️ **Total Tickets:** ${draw.totalTickets}\n` +
            `📅 **Draw:** <t:${Math.floor(draw.drawAt.getTime() / 1000)}:R>\n\n` +
            `Your tickets: **${yourTickets}/${MAX_TICKETS_PER_DRAW}**`,
          )
          .footer(`${TICKET_PRICE} coins per ticket • /lottery buy`)
          .build() as any,
      );
    }

    if (sub === "history") {
      const past = await db
        .select()
        .from(lotteryDraw)
        .where(eq(lotteryDraw.status, "completed"))
        .orderBy(desc(lotteryDraw.createdAt))
        .limit(5);

      if (past.length === 0) {
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title(`${config.emojis.lottery} Lottery History`)
            .body("No completed draws yet!")
            .build() as any,
        );
      }

      const lines = await Promise.all(
        past.map(async (d) => {
          const winner = d.winnerId
            ? await client.users.fetch(d.winnerId).catch(() => null)
            : null;
          const winnerName = winner?.username ?? "Unknown";
          const date = `<t:${Math.floor(d.createdAt.getTime() / 1000)}:d>`;
          return `${date} — ${config.emojis.crown} **${winnerName}** won **${d.totalPot.toLocaleString()}** ${config.emojis.coin} (${d.totalTickets} tickets)`;
        }),
      );

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.lottery} Recent Draws`)
          .body(lines.join("\n"))
          .build() as any,
      );
    }
  },
} as Command;
