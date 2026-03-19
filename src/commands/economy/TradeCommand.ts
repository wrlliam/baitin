import config from "@/config";
import { ui, btn } from "@/ui";
import { Command } from "@/core/typings";
import { allItems } from "@/data";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import { getInventory } from "@/modules/fishing/inventory";
import { executeTrade } from "@/modules/fishing/social";
import { incrementQuestProgress } from "@/modules/fishing/quests";
import { redis } from "@/db/redis";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  MessageFlags,
} from "discord.js";

const TRADE_TIMEOUT = 120_000; // 2 minutes
const MAX_TRADE_ITEMS = 5;

interface TradeItem {
  itemId: string;
  itemType: string;
  qty: number;
}

function formatItems(items: TradeItem[]): string {
  if (items.length === 0) return "*Nothing selected*";
  return items
    .map((i) => {
      const item = allItems.get(i.itemId);
      return item ? `${item.emoji} ${item.name} ×${i.qty}` : `${i.itemId} ×${i.qty}`;
    })
    .join("\n");
}

export default {
  name: "trade",
  description: "Trade items directly with another player.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/trade <user>"],
  defer: "none",
  options: [
    {
      name: "user",
      description: "Who to trade with.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("user", true);

    if (target.id === ctx.user.id) {
      return ctx.reply({ content: `${config.emojis.cross} You can't trade with yourself!`, flags: MessageFlags.Ephemeral });
    }
    if (target.bot) {
      return ctx.reply({ content: `${config.emojis.cross} You can't trade with a bot!`, flags: MessageFlags.Ephemeral });
    }

    // Lock check
    for (const userId of [ctx.user.id, target.id]) {
      const lock = await redis.get(`trade:active:${userId}`);
      if (lock) {
        return ctx.reply({
          content: `${config.emojis.cross} ${userId === ctx.user.id ? "You're" : `**${target.username}** is`} already in a trade!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    await getOrCreateProfile(target.id);

    // Set trade locks
    await redis.send("SETEX", [`trade:active:${ctx.user.id}`, "180", "1"]);
    await redis.send("SETEX", [`trade:active:${target.id}`, "180", "1"]);

    const initiatorItems: TradeItem[] = [];
    const targetItems: TradeItem[] = [];
    let initiatorConfirmed = false;
    let targetConfirmed = false;
    let phase: "initiator_select" | "target_select" | "confirm" = "initiator_select";

    async function cleanup() {
      await redis.send("DEL", [`trade:active:${ctx.user.id}`]);
      await redis.send("DEL", [`trade:active:${target.id}`]);
    }

    function buildTradeView() {
      const builder = ui()
        .color(config.colors.default)
        .title(`${config.emojis.trade} Trade`)
        .text(`**${ctx.user.username}** offers:\n${formatItems(initiatorItems)}`)
        .divider()
        .text(`**${target.username}** offers:\n${formatItems(targetItems)}`);

      if (phase === "confirm") {
        builder.divider().text(
          `${initiatorConfirmed ? config.emojis.tick : "⏳"} ${ctx.user.username} ${initiatorConfirmed ? "confirmed" : "pending"}\n` +
          `${targetConfirmed ? config.emojis.tick : "⏳"} ${target.username} ${targetConfirmed ? "confirmed" : "pending"}`,
        );
      }

      return builder;
    }

    async function buildSelectMenu(userId: string): Promise<ActionRowBuilder<StringSelectMenuBuilder> | null> {
      const inventory = await getInventory(userId);
      const tradeable = inventory.filter((i) => !["rod"].includes(i.itemType));

      if (tradeable.length === 0) return null;

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`trade:select:${userId}`)
        .setPlaceholder("Select items to offer...")
        .setMinValues(1)
        .setMaxValues(Math.min(MAX_TRADE_ITEMS, tradeable.length))
        .addOptions(
          tradeable.slice(0, 25).map((i) => {
            const item = allItems.get(i.itemId);
            return {
              label: `${item?.name ?? i.itemId} ×${i.quantity}`,
              value: i.itemId,
              description: `${item?.category ?? i.itemType}`,
            };
          }),
        );

      return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    }

    function confirmRow(): ActionRowBuilder<ButtonBuilder> {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("trade:confirm").setLabel("Confirm").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("trade:cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger),
      );
    }

    // Start with initiator selecting
    const selectMenu = await buildSelectMenu(ctx.user.id);
    const doneRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("trade:done").setLabel("Done Selecting").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("trade:cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger),
    );

    const rows = selectMenu ? [selectMenu, doneRow] : [doneRow];

    const { resource } = await ctx.reply({
      ...buildTradeView()
        .footer(`${ctx.user.username}: select items to offer, then click Done.`)
        .build({ rows: rows as any }),
      withResponse: true,
    } as any);

    const reply = resource!.message!;

    const collector = reply.createMessageComponentCollector({
      time: TRADE_TIMEOUT,
    });

    collector.on("collect", async (i: any) => {
      // Cancel
      if (i.customId === "trade:cancel") {
        collector.stop("cancelled");
        await cleanup();
        return i.update(
          ui()
            .color(config.colors.error)
            .title(`${config.emojis.trade} Trade Cancelled`)
            .body(`**${i.user.username}** cancelled the trade.`)
            .build() as any,
        );
      }

      // Initiator item selection
      if (i.customId === `trade:select:${ctx.user.id}` && i.user.id === ctx.user.id && phase === "initiator_select") {
        const selected = i.values as string[];
        const inv = await getInventory(ctx.user.id);

        initiatorItems.length = 0;
        for (const itemId of selected) {
          const invRow = inv.find((r) => r.itemId === itemId);
          if (invRow) {
            initiatorItems.push({ itemId, itemType: invRow.itemType, qty: 1 });
          }
        }

        const sm = await buildSelectMenu(ctx.user.id);
        const r = sm ? [sm, doneRow] : [doneRow];

        return i.update({
          ...buildTradeView()
            .footer(`${ctx.user.username}: select items to offer, then click Done.`)
            .build({ rows: r as any }),
        } as any);
      }

      // Initiator done — move to target selection
      if (i.customId === "trade:done" && i.user.id === ctx.user.id && phase === "initiator_select") {
        phase = "target_select";
        const targetMenu = await buildSelectMenu(target.id);
        const targetDoneRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("trade:target_done").setLabel("Done Selecting").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("trade:cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger),
        );

        const r = targetMenu ? [targetMenu, targetDoneRow] : [targetDoneRow];

        return i.update({
          ...buildTradeView()
            .footer(`${target.username}: select items to offer, then click Done.`)
            .build({ rows: r as any }),
        } as any);
      }

      // Target item selection
      if (i.customId === `trade:select:${target.id}` && i.user.id === target.id && phase === "target_select") {
        const selected = i.values as string[];
        const inv = await getInventory(target.id);

        targetItems.length = 0;
        for (const itemId of selected) {
          const invRow = inv.find((r) => r.itemId === itemId);
          if (invRow) {
            targetItems.push({ itemId, itemType: invRow.itemType, qty: 1 });
          }
        }

        const sm = await buildSelectMenu(target.id);
        const targetDoneRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("trade:target_done").setLabel("Done Selecting").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("trade:cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger),
        );

        const r = sm ? [sm, targetDoneRow] : [targetDoneRow];

        return i.update({
          ...buildTradeView()
            .footer(`${target.username}: select items to offer, then click Done.`)
            .build({ rows: r as any }),
        } as any);
      }

      // Target done — move to confirm phase
      if (i.customId === "trade:target_done" && i.user.id === target.id && phase === "target_select") {
        phase = "confirm";

        return i.update({
          ...buildTradeView()
            .footer("Both players must confirm to complete the trade.")
            .build({ rows: [confirmRow()] }),
        } as any);
      }

      // Confirm
      if (i.customId === "trade:confirm" && phase === "confirm") {
        if (i.user.id === ctx.user.id) initiatorConfirmed = true;
        if (i.user.id === target.id) targetConfirmed = true;

        if (initiatorConfirmed && targetConfirmed) {
          collector.stop("completed");

          const result = await executeTrade(ctx.user.id, target.id, initiatorItems, targetItems);
          await cleanup();

          if (!result.success) {
            return i.update(
              ui()
                .color(config.colors.error)
                .title(`${config.emojis.trade} Trade Failed`)
                .body(result.error ?? "Something went wrong.")
                .build() as any,
            );
          }

          void incrementQuestProgress(ctx.user.id, "complete_trade");
          void incrementQuestProgress(target.id, "complete_trade");

          return i.update(
            ui()
              .color(config.colors.success)
              .title(`${config.emojis.trade} Trade Complete!`)
              .text(`**${ctx.user.username}** gave:\n${formatItems(initiatorItems)}`)
              .divider()
              .text(`**${target.username}** gave:\n${formatItems(targetItems)}`)
              .build() as any,
          );
        }

        return i.update({
          ...buildTradeView()
            .footer("Both players must confirm to complete the trade.")
            .build({ rows: [confirmRow()] }),
        } as any);
      }

      // Fallback for unhandled interactions
      if (!i.replied && !i.deferred) {
        await i.deferUpdate().catch(() => {});
      }
    });

    collector.on("end", async (_: any, reason: string) => {
      if (reason === "cancelled" || reason === "completed") return;

      await cleanup();
      await reply.edit(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.trade} Trade Expired`)
          .body("The trade timed out.")
          .build() as any,
      ).catch(() => {});
    });
  },
} as Command;
