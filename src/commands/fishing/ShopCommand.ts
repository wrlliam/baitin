import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import {
  getShopCategory,
  buyShopItem,
  SHOP_CATEGORIES,
  CATEGORY_LABELS,
  type ShopCategory,
  type ShopEntry,
} from "@/modules/fishing/shop";
import { checkGearAchievements } from "@/modules/fishing/achievements";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ApplicationCommandType,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const RARITY_SYMBOLS: Record<string, string> = {
  common: "○",
  uncommon: "◆",
  rare: "◆",
  epic: "❖",
  legendary: "✦",
  mythic: "✦✦",
};

const ITEMS_PER_PAGE = 5;

function buildShopPayload(category: ShopCategory, entries: ShopEntry[], page: number) {
  const start = page * ITEMS_PER_PAGE;
  const pageEntries = entries.slice(start, start + ITEMS_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(entries.length / ITEMS_PER_PAGE));

  const builder = ui()
    .color(config.colors.default)
    .title(CATEGORY_LABELS[category])
    .text("-# ○ Common  ◆ Rare  ❖ Epic  ✦ Legendary")
    .divider();

  if (pageEntries.length === 0) {
    builder.text("*No items available in this category.*");
  } else {
    builder.list(
      pageEntries.map((e) => {
        const symbol = RARITY_SYMBOLS[e.item.rarity] ?? "○";
        const stockLabel =
          e.stock === -1 ? "∞ stock" : e.stock === 0 ? "Sold out" : `${e.stock} left`;
        return ui.item(
          `${e.item.emoji} ${e.item.name} — ${e.buyPrice.toLocaleString()} ${config.emojis.coin}`,
          `${e.item.description}\n-# ${symbol} ${e.item.rarity} · ${stockLabel}`,
          new ButtonBuilder()
            .setCustomId(`shop_buy_${e.item.id}`)
            .setLabel("Buy")
            .setStyle(e.stock === 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(e.stock === 0),
        );
      }),
    );
  }

  builder.footer(`Page ${page + 1}/${totalPages} · Baitin`);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("shop_cat")
      .setPlaceholder("Select a category")
      .addOptions(
        SHOP_CATEGORIES.map((cat) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(CATEGORY_LABELS[cat])
            .setValue(cat)
            .setDefault(cat === category),
        ),
      ),
  );

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("shop_prev")
      .setLabel("◄")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("shop_next")
      .setLabel("►")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  return builder.build({ rows: [selectRow, navRow] });
}

export default {
  name: "shop",
  description: "Browse and buy from the shop.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/shop"],
  options: [],
  run: async ({ args, client, ctx }) => {

    let category: ShopCategory = "bait";
    let page = 0;
    let entries = await getShopCategory(category);

    const message = await ctx.editReply(buildShopPayload(category, entries, page) as any);

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === ctx.user.id,
      time: 120_000,
    });

    collector.on("collect", async (interaction) => {
      if (
        interaction.componentType === ComponentType.StringSelect &&
        interaction.customId === "shop_cat"
      ) {
        category = interaction.values[0] as ShopCategory;
        page = 0;
        entries = await getShopCategory(category);
        await interaction.update(buildShopPayload(category, entries, page) as any);
        return;
      }

      if (interaction.componentType === ComponentType.Button) {
        if (interaction.customId === "shop_prev") {
          page = Math.max(0, page - 1);
          await interaction.update(buildShopPayload(category, entries, page) as any);
          return;
        }

        if (interaction.customId === "shop_next") {
          const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE);
          page = Math.min(totalPages - 1, page + 1);
          await interaction.update(buildShopPayload(category, entries, page) as any);
          return;
        }

        if (interaction.customId.startsWith("shop_buy_")) {
          const itemId = interaction.customId.replace("shop_buy_", "");
          const entry = entries.find((e) => e.item.id === itemId);
          if (!entry) return;

          const symbol = RARITY_SYMBOLS[entry.item.rarity] ?? "○";
          const stockLabel = entry.stock === -1 ? "∞ in stock" : `${entry.stock} left`;

          const detailPayload = ui()
            .color(config.colors.default)
            .title(`${entry.item.emoji} ${entry.item.name}`)
            .text(entry.item.description)
            .divider()
            .text(
              `**Rarity:** \`${symbol} ${entry.item.rarity}\`\n**Price:** ${entry.buyPrice.toLocaleString()} ${config.emojis.coin} each\n**Stock:** ${stockLabel}`,
            )
            .build();

          const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("shop_confirm").setLabel("🛒 Buy").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("shop_cancel").setLabel("✗ Cancel").setStyle(ButtonStyle.Secondary),
          );

          await interaction.reply({
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [...detailPayload.components, confirmRow],
          } as any);

          let detailMsg: any;
          try {
            detailMsg = await interaction.fetchReply();
          } catch {
            return;
          }

          let confirmI: any;
          try {
            confirmI = await detailMsg.awaitMessageComponent({
              componentType: ComponentType.Button,
              filter: (i: any) => i.user.id === ctx.user.id,
              time: 60_000,
            });
          } catch {
            try { await interaction.editReply({ components: [] }); } catch {}
            return;
          }

          if (confirmI.customId === "shop_cancel") {
            await confirmI.update({ components: [] });
            return;
          }

          const qtyModal = new ModalBuilder()
            .setCustomId("shop_qty_modal")
            .setTitle(`Buy ${entry.item.name}`)
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId("shop_qty_input")
                  .setLabel("How many?")
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder("1")
                  .setMinLength(1)
                  .setMaxLength(4)
                  .setRequired(true),
              ),
            );

          await confirmI.showModal(qtyModal);

          let modalI: any;
          try {
            modalI = await confirmI.awaitModalSubmit({
              filter: (m: any) => m.user.id === ctx.user.id,
              time: 60_000,
            });
          } catch {
            return;
          }

          const rawQty = modalI.fields.getTextInputValue("shop_qty_input");
          const qty = Math.max(1, parseInt(rawQty) || 1);

          let totalBought = 0;
          let lastError = "";
          let lastItem: any;
          let totalCost = 0;

          for (let i = 0; i < qty; i++) {
            const result = await buyShopItem(ctx.user.id, itemId);
            if (!result.success) {
              lastError = result.error ?? "Purchase failed.";
              break;
            }
            totalBought++;
            lastItem = result.item;
            totalCost += result.price ?? 0;
          }

          // Achievement checks after purchase
          if (totalBought > 0 && lastItem) {
            await checkGearAchievements(ctx.user.id, {
              boughtRod: lastItem.category === "rod",
              boughtHut: itemId === "hut_permit",
            });
          }

          entries = await getShopCategory(category);
          await message.edit(buildShopPayload(category, entries, page) as any);

          if (totalBought === 0) {
            await modalI.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.cross} ${lastError}`,
            });
          } else {
            const partialNote = totalBought < qty ? ` (only ${totalBought} — ${lastError})` : "";
            await modalI.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.tick} Bought **${totalBought}×** ${lastItem?.emoji} **${lastItem?.name}** for **${totalCost.toLocaleString()}** ${config.emojis.coin}!${partialNote}`,
            });
          }

          return;
        }
      }
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch {}
    });
  },
} as Command;
