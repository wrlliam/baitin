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
  getActiveListingCount,
  canAuction,
} from "@/modules/fishing/market";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "discord.js";

export default {
  name: "market",
  description: "Trade items with other players.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/market browse", "/market list", "/market bid", "/market cancel"],
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
          description: "Page number.",
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
      name: "bid",
      description: "Place a bid on an auction.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "listing_id",
          description: "The listing ID to bid on.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "amount",
          description: "Your bid amount.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
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
  run: async ({ args, client, ctx }) => {
    await ctx.deferReply();
    const sub = args.getSubcommand();

    if (sub === "browse") {
      const category = args.getString("filter") ?? undefined;
      const page = args.getInteger("page") ?? 1;
      const listings = await getListings({ category, page, pageSize: 10 });

      if (listings.length === 0) {
        return ctx.editReply({ content: "No listings found." });
      }

      const lines = listings.map((l) => {
        const item = allItems.get(l.itemId);
        const label = item
          ? `${item.emoji} ${item.name} ×${l.quantity}`
          : `${l.itemId} ×${l.quantity}`;
        const priceLabel = l.isAuction
          ? `Auction — highest bid: ${config.emojis.coin} ${(l.highestBid ?? 0).toLocaleString()}`
          : `${config.emojis.coin} ${l.pricePerUnit.toLocaleString()}/ea`;
        return `\`${l.id.slice(0, 8)}\` ${label} — ${priceLabel}`;
      });

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("📦 Market Listings")
          .body(lines.join("\n"))
          .footer(
            `Page ${page} • Use listing ID with /market bid or /market cancel`,
          )
          .build() as any,
      );
    }

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
        return ctx.editReply({
          content: `${config.emojis.cross} Unknown item.`,
        });

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
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
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

    if (sub === "bid") {
      const listingId = args.getString("listing_id", true);
      const amount = args.getInteger("amount", true);
      const result = await placeBid(ctx.user.id, listingId, amount);

      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      return ctx.editReply({
        content: `${config.emojis.tick} Bid of **${amount.toLocaleString()}** ${config.emojis.coin} placed!`,
      });
    }

    if (sub === "cancel") {
      const listingId = args.getString("listing_id", true);
      const result = await cancelListing(ctx.user.id, listingId);

      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      return ctx.editReply({
        content: `${config.emojis.tick} Listing cancelled. Your item has been returned to your sack.`,
      });
    }
  },
} as Command;
