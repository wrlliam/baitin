import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { allItems } from "@/data";
import { getInventory } from "@/modules/fishing/inventory";
import {
  createListing,
  buyListing,
  placeBid,
  cancelListing,
  getListings,
  getListingCount,
  getActiveListingCount,
  canAuction,
} from "@/modules/fishing/market";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const PAGE_SIZE = 5;

const FILTER_CHOICES = [
  { label: "All", value: "all", emoji: config.emojis.market_all },
  { label: "Fish", value: "fish", emoji: config.emojis.fish },
  { label: "Junk", value: "junk", emoji: config.emojis.junk },
  { label: "Bait", value: "bait", emoji: config.emojis.bait },
  { label: "Rod", value: "rod", emoji: config.emojis.cat_fishing },
] as const;

async function buildBrowsePage(page: number, category?: string, userId: string = "") {
  const [listings, total] = await Promise.all([
    getListings({ category, page, pageSize: PAGE_SIZE }),
    getListingCount({ category }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const catStr = category ?? "all";

  const embed = ui()
    .color(config.colors.default)
    .title(`${config.emojis.market_all} Market Listings`)
    .text(
      total === 0
        ? "No listings found."
        : `**${total}** listing${total !== 1 ? "s" : ""} available`,
    );

  if (listings.length > 0) {
    embed.divider();
    for (const l of listings) {
      const item = allItems.get(l.itemId);
      const itemLabel = item
        ? `${item.emoji} **${item.name}** ×${l.quantity}`
        : `\`${l.itemId}\` ×${l.quantity}`;
      const priceLabel = l.isAuction
        ? `Auction — top bid: ${config.emojis.coin} ${(l.highestBid ?? 0).toLocaleString()} · min: ${l.pricePerUnit.toLocaleString()}`
        : `${config.emojis.coin} ${l.pricePerUnit.toLocaleString()}/ea`;

      const btn = l.isAuction
        ? ui.btn(`${config.emojis.market_bid} Bid`, `mkt:bid:${l.id}`, ButtonStyle.Primary)
        : ui.btn(`${config.emojis.market_buy} Buy`, `mkt:buy:${l.id}`, ButtonStyle.Success);

      embed.section(`${itemLabel}\n-# ${priceLabel}`, btn);
    }
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`mkt:nav:${page - 1}:${catStr}:${userId}`)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId("mkt:page_info")
      .setLabel(`Page ${page}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`mkt:nav:${page + 1}:${catStr}:${userId}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );

  const filterRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    FILTER_CHOICES.map(({ label, value, emoji }) =>
      new ButtonBuilder()
        .setCustomId(`mkt:filter:${value}:${userId}`)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(value === catStr ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );

  return { embed, navRow, filterRow };
}

export default {
  name: "market",
  description: "Trade items with other players.",
  type: ApplicationCommandType.ChatInput,
  defer: "none",
  usage: ["/market browse", "/market list", "/market cancel"],
  options: [
    {
      name: "browse",
      description: "Browse active market listings.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "filter",
          description: "Filter by item category.",
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: "Fish", value: "fish" },
            { name: "Junk", value: "junk" },
            { name: "Bait", value: "bait" },
            { name: "Rod", value: "rod" },
          ],
        },
        {
          name: "page",
          description: "Starting page number.",
          type: ApplicationCommandOptionType.Integer,
          required: false,
          minValue: 1,
        },
      ],
    },
    {
      name: "list",
      description: "List an item for sale.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "item",
          description: "The item to list.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "quantity",
          description: "How many to list.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
        },
        {
          name: "price",
          description: "Price per unit.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
        },
        {
          name: "auction",
          description: "List as an auction instead of fixed price.",
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
        {
          name: "duration_hours",
          description: "Auction duration in hours (default: 24).",
          type: ApplicationCommandOptionType.Integer,
          required: false,
          minValue: 1,
          maxValue: 72,
        },
      ],
    },
    {
      name: "cancel",
      description: "Cancel one of your listings.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "listing_id",
          description: "The listing ID to cancel.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],
  autocomplete: async ({ ctx }) => {
    const focused = ctx.options.getFocused(true);
    const inventory = await getInventory(ctx.user.id);

    return ctx.respond(
      inventory
        .map((i) => {
          const item = allItems.get(i.itemId);
          return item
            ? { name: `${item.name} ×${i.quantity}`, value: i.itemId }
            : null;
        })
        .filter(Boolean)
        .filter((c) =>
          c!.name
            .toLowerCase()
            .includes((focused.value as string).toLowerCase()),
        )
        .slice(0, 25) as { name: string; value: string }[],
    );
  },
  run: async ({ args, ctx }) => {
    const sub = args.getSubcommand();

    if (sub === "browse") {
      await ctx.deferReply({});
      const categoryArg = args.getString("filter") ?? undefined;
      const pageArg = args.getInteger("page") ?? 1;
      let curPage = pageArg;
      let curCategory = categoryArg;

      const { embed, navRow, filterRow } = await buildBrowsePage(curPage, curCategory, ctx.user.id);
      const message = await ctx.editReply(embed.build({ rows: [navRow, filterRow] }) as any);

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5 * 60 * 1000,
      });

      collector.on("collect", async (i) => {
        const parts = i.customId.split(":");
        const action = parts[1];

        if (action === "nav") {
          const buttonUserId = parts[4];
          if (i.user.id !== buttonUserId) return i.deferUpdate();
          curPage = parseInt(parts[2], 10);
          curCategory = parts[3] === "all" ? undefined : parts[3];
          const { embed: e, navRow: nr, filterRow: fr } = await buildBrowsePage(curPage, curCategory, ctx.user.id);
          return i.update(e.build({ rows: [nr, fr] }) as any);
        }

        if (action === "filter") {
          const buttonUserId = parts[3];
          if (i.user.id !== buttonUserId) return i.deferUpdate();
          curCategory = parts[2] === "all" ? undefined : parts[2];
          curPage = 1;
          const { embed: e, navRow: nr, filterRow: fr } = await buildBrowsePage(curPage, curCategory, ctx.user.id);
          return i.update(e.build({ rows: [nr, fr] }) as any);
        }

        if (action === "buy") {
          const listingId = parts[2];
          const result = await buyListing(i.user.id, listingId);
          if (!result.success) {
            return i.reply({ content: `${config.emojis.cross} ${result.error}`, flags: MessageFlags.Ephemeral });
          }
          const { embed: e, navRow: nr, filterRow: fr } = await buildBrowsePage(curPage, curCategory, ctx.user.id);
          return i.update(e.build({ rows: [nr, fr] }) as any);
        }

        if (action === "bid") {
          const listingId = parts[2];
          const modal = new ModalBuilder()
            .setCustomId(`mkt:bidmodal:${listingId}`)
            .setTitle("Place a Bid");
          const amountInput = new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("Your bid amount (coins)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(10);
          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput),
          );
          await i.showModal(modal);

          try {
            const modalI = await i.awaitModalSubmit({ time: 60 * 1000 });
            const amount = parseInt(modalI.fields.getTextInputValue("amount").trim(), 10);
            if (isNaN(amount) || amount < 1) {
              await modalI.reply({ content: `${config.emojis.cross} Invalid bid amount.`, flags: MessageFlags.Ephemeral });
              return;
            }
            const result = await placeBid(i.user.id, listingId, amount);
            if (!result.success) {
              await modalI.reply({ content: `${config.emojis.cross} ${result.error}`, flags: MessageFlags.Ephemeral });
            } else {
              await modalI.reply({
                content: `${config.emojis.tick} Bid of **${amount.toLocaleString()}** ${config.emojis.coin} placed!`,
                flags: MessageFlags.Ephemeral,
              });
              const { embed: e, navRow: nr, filterRow: fr } = await buildBrowsePage(curPage, curCategory, ctx.user.id);
              await message.edit(e.build({ rows: [nr, fr] }) as any);
            }
          } catch {
            // Modal timed out
          }
          return;
        }

        await i.deferUpdate();
      });

      collector.on("end", async () => {
        try { await message.edit({ components: [] }); } catch {}
      });

      return;
    }

    // Non-browse subcommands — ephemeral
    await ctx.deferReply({ flags: MessageFlags.Ephemeral });

    if (sub === "list") {
      const itemId = args.getString("item", true);
      const qty = args.getInteger("quantity", true);
      const price = args.getInteger("price", true);
      const isAuction = args.getBoolean("auction") ?? false;
      const durationHours = args.getInteger("duration_hours") ?? 24;

      const activeCount = await getActiveListingCount(ctx.user.id);
      if (activeCount >= config.fishing.maxAuctionListings) {
        return ctx.editReply({
          content: `${config.emojis.cross} You can only have ${config.fishing.maxAuctionListings} active listings at once.`,
        });
      }

      if (isAuction && !canAuction(itemId)) {
        return ctx.editReply({
          content: `${config.emojis.cross} Only **rare** or better items can be auctioned.`,
        });
      }

      const item = allItems.get(itemId);
      if (!item)
        return ctx.editReply({ content: `${config.emojis.cross} Unknown item.` });

      const maxPrice = Math.floor(item.price * 1.75);
      if (price > maxPrice) {
        return ctx.editReply({
          content: `${config.emojis.cross} Max price for **${item.emoji} ${item.name}** is **${maxPrice.toLocaleString()}** ${config.emojis.coin}/ea (175% of base value).`,
        });
      }

      const durationMs = isAuction ? durationHours * 60 * 60 * 1000 : undefined;
      const result = await createListing(
        ctx.user.id,
        itemId,
        item.category,
        qty,
        price,
        isAuction,
        durationMs,
      );

      if (!result.success) {
        return ctx.editReply({ content: `${config.emojis.cross} ${result.error}` });
      }

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Listed!`)
          .body(
            `**${qty}× ${item.emoji} ${item.name}** listed${isAuction ? " for auction starting at" : " for"} **${price.toLocaleString()}** ${config.emojis.coin}/ea.`,
          )
          .footer(`Listing ID: ${result.listingId}`)
          .build() as any,
      );
    }

    if (sub === "cancel") {
      const listingId = args.getString("listing_id", true);
      const result = await cancelListing(ctx.user.id, listingId);

      if (!result.success) {
        return ctx.editReply({ content: `${config.emojis.cross} ${result.error}` });
      }

      return ctx.editReply({
        content: `${config.emojis.tick} Listing cancelled. Your item has been returned to your sack.`,
      });
    }
  },
} as Command;
