import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getItemsByCategory, allItems, petItems } from "@/data";
import { events as eventsList } from "@/data/events";
import { pets } from "@/data/pets";
import { addCoins, addXp, getOrCreateProfile } from "@/modules/fishing/economy";
import { addItem, getInventory } from "@/modules/fishing/inventory";
import { getUserPets } from "@/modules/fishing/pets";
import { addBuff, getActiveBuffs } from "@/modules/fishing/buffs";
import {
  banUser,
  timeoutUser,
  unrestrictUser,
  getReportsForUser,
  parseDuration,
  formatDuration,
  isUserRestricted,
} from "@/modules/moderation";
import {
  getActiveEvent,
  activateEvent,
  stopEvent,
  broadcastEventAnnouncement,
} from "@/modules/fishing/events";
import { db } from "@/db";
import {
  fishingProfile,
  fishingInventory,
  petInstance,
  hut,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { redis } from "@/db/redis";
import type {
  BaseItem,
  Fish,
  JunkItem,
  Rod,
  Bait,
  Egg,
  Potion,
  Pet,
} from "@/data/types";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const DEV_CATEGORIES = ["fish", "junk", "bait", "rod", "egg", "misc"] as const;
type DevCategory = (typeof DEV_CATEGORIES)[number];

const CATEGORY_LABELS: Record<DevCategory, string> = {
  fish: "🐟 Fish",
  junk: "🗑️ Junk",
  bait: `${config.emojis.bait} Bait`,
  rod: `${config.emojis.rod} Rods`,
  egg: `${config.emojis.egg} Eggs`,
  misc: "📦 Misc",
};

const RARITY_COLORS: Record<string, string> = {
  common: "⬜",
  uncommon: "🟩",
  rare: "🟦",
  epic: "🟪",
  legendary: "🟨",
  mythic: "🟥",
};

const BUFF_TYPES = [
  { name: "XP Boost", value: "xp_boost" },
  { name: "Coin Boost", value: "coin_boost" },
  { name: "Luck Boost", value: "luck_boost" },
  { name: "Cooldown Reduction", value: "cooldown_reduction" },
  { name: "Hatch Speed", value: "hatch_speed" },
  { name: "Pet Effect Boost", value: "pet_effect_boost" },
  { name: "Cost Reduction", value: "cost_reduction" },
] as const;
type BuffType = (typeof BUFF_TYPES)[number]["value"];

const ITEMS_PER_PAGE = 4;
const PETS_PER_PAGE = 3;

// ── Item detail formatter ──────────────────────────────────────────────────

function formatItemDetail(item: BaseItem): string {
  const lines: string[] = [
    `${item.emoji} **${item.name}** — \`${item.id}\``,
    `${RARITY_COLORS[item.rarity] ?? "⬜"} ${item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)} · ${item.price > 0 ? `${item.price.toLocaleString()} coins` : "Special"}`,
  ];

  if (item.description) lines.push(`*${item.description}*`);

  const cat = item.category;

  if (cat === "fish") {
    const f = item as Fish;
    lines.push(`Weight: **${f.weight}kg** · XP: **${f.xp}**`);
    if (f.pros?.length) lines.push(`✅ ${f.pros.join(", ")}`);
    if (f.cons?.length) lines.push(`❌ ${f.cons.join(", ")}`);
  }

  if (cat === "junk") {
    const j = item as JunkItem;
    lines.push(`Weight: **${j.weight}kg**`);
    if (j.pros?.length) lines.push(`✅ ${j.pros.join(", ")}`);
    if (j.cons?.length) lines.push(`❌ ${j.cons.join(", ")}`);
  }

  if (cat === "rod") {
    const r = item as Rod;
    const stats: string[] = [];
    if (r.luckBonus) stats.push(`Luck +${Math.round(r.luckBonus * 100)}%`);
    if (r.speedReduction)
      stats.push(`Speed +${Math.round(r.speedReduction * 100)}%`);
    if (r.durability) stats.push(`Durability: ${r.durability}`);
    if (stats.length) lines.push(stats.join(" · "));
  }

  if (cat === "bait") {
    const b = item as Bait;
    const stats: string[] = [];
    if (b.rarityMultiplier !== 1) stats.push(`Rarity ×${b.rarityMultiplier}`);
    if (b.junkModifier)
      stats.push(
        `Junk ${b.junkModifier > 0 ? "+" : ""}${Math.round(b.junkModifier * 100)}%`,
      );
    if (b.consumedOnUse) stats.push("Consumed on use");
    if (stats.length) lines.push(stats.join(" · "));
  }

  if (cat === "egg") {
    const e = item as Egg;
    const hours = Math.floor(e.hatchTimeMinutes / 60);
    const mins = e.hatchTimeMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    lines.push(
      `Hatch: **${timeStr}** · Fail: **${Math.round(e.failChance * 100)}%**`,
    );
    if (e.possiblePets.length) {
      const petNames = e.possiblePets
        .map((id) => petItems.get(id)?.name ?? id)
        .slice(0, 5);
      lines.push(
        `Pets: ${petNames.join(", ")}${e.possiblePets.length > 5 ? ` +${e.possiblePets.length - 5} more` : ""}`,
      );
    }
  }

  if (cat === "misc") {
    const p = item as Potion;
    if (p.effects?.length) {
      const fx = p.effects.map((e) => {
        const sign = e.amount >= 0 ? "+" : "";
        return `${e.type.replace(/_/g, " ")} ${sign}${Math.round(e.amount * 100)}% (${e.durationMinutes}m)`;
      });
      lines.push(fx.join("\n"));
    }
  }

  return lines.join("\n");
}

// ── Pet detail formatter ──────────────────────────────────────────────────

function formatPetDetail(pet: Pet): string {
  const lines: string[] = [
    `${pet.emoji} **${pet.name}** — \`${pet.id}\``,
    `${RARITY_COLORS[pet.rarity] ?? "⬜"} ${pet.rarity.charAt(0).toUpperCase() + pet.rarity.slice(1)}`,
  ];

  if (pet.description) lines.push(`*${pet.description}*`);

  if (pet.buffs?.length) {
    const fx = pet.buffs.map((b) => {
      const sign = b.value >= 0 ? "+" : "";
      return `${b.type.replace(/_/g, " ")} ${sign}${Math.round(b.value * 100)}%`;
    });
    lines.push(`Buffs: ${fx.join(", ")}`);
  }

  if (pet.pros?.length) lines.push(`✅ ${pet.pros.join(", ")}`);
  if (pet.cons?.length) lines.push(`❌ ${pet.cons.join(", ")}`);

  return lines.join("\n");
}

// ── give-item browser helpers ──────────────────────────────────────────────

function buildGiveItemPayload(
  category: DevCategory,
  page: number,
  targetName: string,
) {
  const items = getItemsByCategory(category);
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const start = page * ITEMS_PER_PAGE;
  const pageItems = items.slice(start, start + ITEMS_PER_PAGE);

  const builder = ui()
    .color(config.colors.default)
    .title(`🎁 Give Item — ${targetName}`)
    .text(`-# ${CATEGORY_LABELS[category]} · Page ${page + 1}/${totalPages}`)
    .divider();

  if (pageItems.length === 0) {
    builder.text("*No items in this category.*");
  } else {
    builder.list(
      pageItems.map((item) =>
        ui.item(
          formatItemDetail(item).split("\n")[0], // Title
          formatItemDetail(item).split("\n").slice(1).join("\n"), // Details
          new ButtonBuilder()
            .setCustomId(`give_item_${item.id}`)
            .setLabel("Give")
            .setStyle(ButtonStyle.Primary),
        ),
      ),
    );
  }

  // Category select + nav buttons
  const select = new StringSelectMenuBuilder()
    .setCustomId("give_cat")
    .setPlaceholder("Select a category")
    .addOptions(
      DEV_CATEGORIES.map((cat) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(CATEGORY_LABELS[cat])
          .setValue(cat)
          .setDefault(cat === category),
      ),
    );
  const selectRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("give_prev")
      .setLabel("◄")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("give_next")
      .setLabel("►")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  return builder.build({ rows: [selectRow, navRow] }) as any;
}

// ── give-pet browser helpers ──────────────────────────────────────────────

function buildGivePetPayload(page: number, targetName: string) {
  const allPets = [...petItems.values()];
  const totalPages = Math.max(1, Math.ceil(allPets.length / PETS_PER_PAGE));
  const start = page * PETS_PER_PAGE;
  const pagePets = allPets.slice(start, start + PETS_PER_PAGE);

  const builder = ui()
    .color(config.colors.default)
    .title(`🐾 Give Pet — ${targetName}`)
    .text(`-# Page ${page + 1}/${totalPages}`)
    .divider();

  if (pagePets.length === 0) {
    builder.text("*No pets available.*");
  } else {
    builder.list(
      pagePets.map((pet) =>
        ui.item(
          formatPetDetail(pet).split("\n")[0], // Title
          formatPetDetail(pet).split("\n").slice(1).join("\n"), // Details
          new ButtonBuilder()
            .setCustomId(`give_pet_${pet.id}`)
            .setLabel("Give")
            .setStyle(ButtonStyle.Primary),
        ),
      ),
    );
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("givepet_prev")
      .setLabel("◄")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("givepet_next")
      .setLabel("►")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  return builder.build({ rows: [navRow] }) as any;
}

// ── Buff helpers ───────────────────────────────────────────────────────────

const BUFF_KEY = (userId: string) => `buff:${userId}`;

async function removeBuffType(userId: string, type: BuffType) {
  const buffs = await getActiveBuffs(userId);
  const filtered = buffs.filter((b) => b.type !== type);
  if (filtered.length === 0) {
    await redis.del(BUFF_KEY(userId));
    return 0;
  }
  const now = Date.now();
  const maxTtlMs = Math.max(...filtered.map((b) => b.expiresAt - now));
  const ttlSeconds = Math.max(1, Math.ceil(maxTtlMs / 1000));
  await redis.set(BUFF_KEY(userId), JSON.stringify(filtered));
  await redis.send("EXPIRE", [BUFF_KEY(userId), ttlSeconds.toString()]);
  return buffs.length - filtered.length;
}

// ─────────────────────────────────────────────────────────────────────────

export default {
  name: "dev",
  description: "Developer-only admin tools.",
  type: ApplicationCommandType.ChatInput,
  devOnly: true,
  defer: true,
  usage: [
    "/dev give-coins <user> <amount>",
    "/dev give-xp <user> <amount>",
    "/dev give-item <user>",
    "/dev give-hut <user>",
    "/dev give-pet <user>",
    "/dev inv-remove <user> <item> <qty>",
    "/dev inv-set-qty <user> <item> <qty>",
    "/dev inv-clear <user>",
    "/dev buff-add <user> <type> <amount> <minutes>",
    "/dev buff-clear <user>",
    "/dev buff-remove <user> <type>",
    "/dev pet-remove <user> <pet>",
    "/dev pet-set-level <user> <pet> <level>",
    "/dev leaderboard-toggle <user>",
    "/dev reset-user <user>",
    "/dev event-start <event>",
    "/dev event-stop",
    "/dev event-list",
    "/dev ban <user> [reason]",
    "/dev timeout <user> <duration> [reason]",
    "/dev unban <user_id>",
    "/dev mod-info <user_id>",
    "/dev reports <user_id>",
  ],
  options: [
    // ── Economy ──
    {
      name: "give-coins",
      description: "Give coins to a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "amount",
          description: "Number of coins.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
        },
      ],
    },
    {
      name: "give-xp",
      description: "Give XP to a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "amount",
          description: "Amount of XP.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
        },
      ],
    },
    {
      name: "give-item",
      description: "Give an item to a user (interactive browser).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    {
      name: "give-hut",
      description:
        "Give a user the Fishing Hut (sets hutOwned + creates hut row).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    {
      name: "give-pet",
      description: "Give a user a pet (interactive browser).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    // ── Inventory ──
    {
      name: "inv-remove",
      description: "Remove quantity of an item from a user's inventory.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "item",
          description: "Item to remove.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "qty",
          description: "Quantity to remove.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
        },
      ],
    },
    {
      name: "inv-set-qty",
      description: "Set exact quantity of an item (0 = removes it).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "item",
          description: "Item ID.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "qty",
          description: "New quantity (0 removes the item).",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 0,
        },
      ],
    },
    {
      name: "inv-clear",
      description: "Clear a user's entire inventory.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    // ── Buffs ──
    {
      name: "buff-add",
      description: "Add a buff to a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "type",
          description: "Buff type.",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: BUFF_TYPES.map((b) => ({ name: b.name, value: b.value })),
        },
        {
          name: "amount",
          description: "Amount (0.5 = +50%, use negative for debuffs).",
          type: ApplicationCommandOptionType.Number,
          required: true,
          minValue: -1,
          maxValue: 10,
        },
        {
          name: "minutes",
          description: "Duration in minutes.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
          maxValue: 1440,
        },
      ],
    },
    {
      name: "buff-clear",
      description: "Clear all active buffs from a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    {
      name: "buff-remove",
      description: "Remove all buffs of a specific type from a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "type",
          description: "Buff type to remove.",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: BUFF_TYPES.map((b) => ({ name: b.name, value: b.value })),
        },
      ],
    },
    // ── Pets ──
    {
      name: "pet-remove",
      description: "Delete a pet instance from a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "pet",
          description: "Pet instance to remove.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "pet-set-level",
      description: "Set the level of a user's pet (1–10).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "pet",
          description: "Pet instance.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "level",
          description: "New level.",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          minValue: 1,
          maxValue: 10,
        },
      ],
    },
    // ── Events ──
    {
      name: "event-start",
      description: "Manually start a fishing event (interactive menu).",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "event-stop",
      description: "Stop the currently active event.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "event-list",
      description: "List all available events.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    // ── Misc ──
    {
      name: "leaderboard-toggle",
      description: "Toggle leaderboard visibility for a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    {
      name: "reset-user",
      description: "Fully reset a user (profile, inventory, pets, hut, buffs).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "Target user.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
      ],
    },
    // ── Moderation ──
    {
      name: "ban",
      description: "Permanently ban a user from the bot.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "User to ban.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "reason",
          description: "Reason for the ban.",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    },
    {
      name: "timeout",
      description: "Temporarily restrict a user (e.g. 10m, 2h, 1d, 1w).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user",
          description: "User to time out.",
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: "duration",
          description: "Duration: 30s · 10m · 2h · 1d · 1w",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "reason",
          description: "Reason for the timeout.",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    },
    {
      name: "unban",
      description: "Remove an active ban or timeout from a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user_id",
          description: "User ID to unban/untimeout.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "mod-info",
      description: "Check if a user is currently restricted.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user_id",
          description: "User ID to check.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "reports",
      description: "View reports filed against a user.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "user_id",
          description: "User ID to check.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],

  autocomplete: async ({ ctx }) => {
    const sub = ctx.options.getSubcommand();
    const focused = ctx.options.getFocused(true);
    const value = (focused.value as string).toLowerCase();

    // User-dependent autocomplete: read the user option
    const rawUser = ctx.options.get("user");
    const targetId = rawUser?.value as string | undefined;

    // inv-remove / inv-set-qty → show user's inventory
    if (
      (sub === "inv-remove" || sub === "inv-set-qty") &&
      focused.name === "item"
    ) {
      if (!targetId) return ctx.respond([]);
      const inventory = await getInventory(targetId);
      return ctx.respond(
        inventory
          .map((i) => {
            const item = allItems.get(i.itemId);
            return item
              ? {
                  name: `${item.emoji} ${item.name} ×${i.quantity}`,
                  value: i.itemId,
                }
              : null;
          })
          .filter(Boolean)
          .filter((c) => c!.name.toLowerCase().includes(value))
          .slice(0, 25) as { name: string; value: string }[],
      );
    }

    // pet-remove / pet-set-level → show user's pet instances
    if (
      (sub === "pet-remove" || sub === "pet-set-level") &&
      focused.name === "pet"
    ) {
      if (!targetId) return ctx.respond([]);
      const userPets = await getUserPets(targetId);
      return ctx.respond(
        userPets
          .map((p) => {
            const def = petItems.get(p.petId);
            const label = `${def?.emoji ?? "?"} ${p.name ?? def?.name ?? "Unknown"} Lv ${p.petLevel} [${p.id.slice(0, 8)}]`;
            return { name: label, value: p.id };
          })
          .filter((c) => c.name.toLowerCase().includes(value))
          .slice(0, 25),
      );
    }

    return ctx.respond([]);
  },

  run: async ({ args, client, ctx }) => {
    const sub = args.getSubcommand();

    // ── event-start ──────────────────────────────────────────────────────
    if (sub === "event-start") {
      const active = await getActiveEvent();
      const select = new StringSelectMenuBuilder()
        .setCustomId("devevt:select")
        .setPlaceholder("Choose an event to start…")
        .addOptions(
          eventsList.slice(0, 25).map((e) => {
            const durationMins = Math.round(e.duration / 60000);
            const effectSummary = e.effects.map((ef) => ef.type).join(", ");
            return new StringSelectMenuOptionBuilder()
              .setLabel(e.name)
              .setValue(e.id)
              .setDescription(`${durationMins}min · ${effectSummary}`.slice(0, 100))
              .setDefault(active?.id === e.id);
          }),
        );

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      const message = await ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🎪 Start an Event")
          .text(
            active
              ? `Currently active: **${active.name}** — starting another will replace it.`
              : "No event is currently active.",
          )
          .footer(`${eventsList.length} events available`)
          .build({ rows: [selectRow as any] }) as any,
      );

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === ctx.user.id,
        max: 1,
        time: 60 * 1000,
      });

      collector.on("collect", async (i) => {
        const eventId = i.values[0];
        const event = eventsList.find((e) => e.id === eventId);
        if (!event) {
          return i.update({ content: `${config.emojis.cross} Unknown event.`, components: [] });
        }
        await activateEvent(eventId);
        await broadcastEventAnnouncement(event, client);
        const durationMins = Math.round(event.duration / 60000);
        const effectLines = event.effects
          .map((e) => `• ${e.type.replace(/_/g, " ")}: ×${e.value}`)
          .join("\n");
        return i.update(
          ui()
            .color(config.colors.success)
            .title(`🎪 Event Started: ${event.name}`)
            .text(event.description)
            .divider()
            .text(`**Effects:**\n${effectLines}\n\n**Duration:** ${durationMins} minutes`)
            .footer("Players will see this event via /event")
            .build() as any,
        );
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          try { message.edit({ components: [] }); } catch {}
        }
      });

      return;
    }

    // ── event-stop ───────────────────────────────────────────────────────
    if (sub === "event-stop") {
      const stopped = await stopEvent();
      if (!stopped) {
        return ctx.editReply({
          content: `${config.emojis.cross} No active event to stop.`,
        });
      }
      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title("🎪 Event Stopped")
          .text("The active event has been ended early.")
          .build() as any,
      );
    }

    // ── event-list ───────────────────────────────────────────────────────
    if (sub === "event-list") {
      const active = await getActiveEvent();
      const lines = eventsList.map((e) => {
        const isActive = active?.id === e.id ? " *(active)*" : "";
        const durationMins = Math.round(e.duration / 60000);
        return `**${e.name}** \`${e.id}\`${isActive}\n-# ${durationMins}min · ${e.effects.map((ef) => ef.type).join(", ")}`;
      });
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🎪 All Events")
          .text(lines.join("\n\n"))
          .footer(`${eventsList.length} events available`)
          .build() as any,
      );
    }

    // ── unban ────────────────────────────────────────────────────────────
    if (sub === "unban") {
      const userId = args.getString("user_id", true).trim();
      const removed = await unrestrictUser(userId);
      if (!removed) {
        return ctx.editReply({
          content: `${config.emojis.cross} No active ban or timeout found for \`${userId}\`.`,
        });
      }
      return ctx.editReply(
        ui()
          .color(config.colors.success)
          .title(`${config.emojis.tick} Restriction Removed`)
          .body(`Removed active ban/timeout for \`${userId}\`.`)
          .build() as any,
      );
    }

    // ── mod-info ─────────────────────────────────────────────────────────
    if (sub === "mod-info") {
      const userId = args.getString("user_id", true).trim();
      const status = await isUserRestricted(userId);
      if (!status.restricted) {
        return ctx.editReply(
          ui()
            .color(config.colors.success)
            .title("No Restriction")
            .body(`\`${userId}\` has no active ban or timeout.`)
            .build() as any,
        );
      }
      const lines = [
        `**Type:** ${status.type === "ban" ? "Permanent Ban" : "Timeout"}`,
        status.reason ? `**Reason:** ${status.reason}` : null,
        status.expiresAt
          ? `**Expires:** <t:${Math.floor(status.expiresAt.getTime() / 1000)}:R>`
          : null,
      ].filter(Boolean);
      return ctx.editReply(
        ui()
          .color(config.colors.error)
          .title(`${config.emojis.mod} Restricted — \`${userId}\``)
          .body(lines.join("\n"))
          .build() as any,
      );
    }

    // ── reports ──────────────────────────────────────────────────────────
    if (sub === "reports") {
      const userId = args.getString("user_id", true).trim();
      const reports = await getReportsForUser(userId);
      if (!reports.length) {
        return ctx.editReply(
          ui()
            .color(config.colors.success)
            .title("No Reports")
            .body(`No reports found for \`${userId}\`.`)
            .build() as any,
        );
      }
      const lines = reports.slice(0, 10).map((r, i) => {
        const ts = Math.floor(new Date(r.createdAt).getTime() / 1000);
        return [
          `**${i + 1}.** <t:${ts}:d> · [${r.status.toUpperCase()}]`,
          `Reporter: \`${r.reporterId}\``,
          `Reason: ${r.reason}`,
          r.evidence ? `Evidence: ${r.evidence}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      });
      const header =
        reports.length > 10
          ? `Showing 10 of **${reports.length}** reports for \`${userId}\``
          : `**${reports.length}** report${reports.length === 1 ? "" : "s"} for \`${userId}\``;
      return ctx.editReply(
        ui()
          .color(config.colors.warn)
          .title(`📋 Reports — \`${userId}\``)
          .body([header, "", ...lines].join("\n"))
          .build() as any,
      );
    }

    const target = args.getUser("user", true);

    // ── give-coins ──────────────────────────────────────────────────────
    if (sub === "give-coins") {
      const amount = args.getInteger("amount", true);
      await addCoins(target.id, amount);
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Coins Given`)
          .body(
            `Gave **${amount.toLocaleString()}** ${config.emojis.coin} to **${target.username}**.`,
          )
          .build() as any,
      );
    }

    // ── give-xp ─────────────────────────────────────────────────────────
    if (sub === "give-xp") {
      const amount = args.getInteger("amount", true);
      const { levelUp, newLevel } = await addXp(target.id, amount);
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} XP Given`)
          .body(
            `Gave **${amount.toLocaleString()} XP** to **${target.username}**.${levelUp ? ` They are now level **${newLevel}**!` : ""}`,
          )
          .build() as any,
      );
    }

    // ── give-hut ─────────────────────────────────────────────────────────
    if (sub === "give-hut") {
      await getOrCreateProfile(target.id);
      await db
        .update(fishingProfile)
        .set({ hutOwned: true })
        .where(eq(fishingProfile.userId, target.id));
      const existing = await db
        .select()
        .from(hut)
        .where(eq(hut.userId, target.id));
      if (!existing[0]) {
        await db.insert(hut).values({ id: createId(), userId: target.id });
      }
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Hut Granted`)
          .body(`**${target.username}** now owns the Fishing Hut.`)
          .build() as any,
      );
    }

    // ── give-pet (interactive browser) ────────────────────────────────────
    if (sub === "give-pet") {
      let page = 0;
      const allPets = [...petItems.values()];
      const totalPages = Math.max(1, Math.ceil(allPets.length / PETS_PER_PAGE));

      const message = await ctx.editReply(
        buildGivePetPayload(page, target.username),
      );

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === ctx.user.id,
        time: 120_000,
      });

      collector.on("collect", async (interaction) => {
        if (interaction.componentType === ComponentType.Button) {
          if (interaction.customId === "givepet_prev") {
            page = Math.max(0, page - 1);
            await interaction.update(
              buildGivePetPayload(page, target.username),
            );
            return;
          }
          if (interaction.customId === "givepet_next") {
            page = Math.min(totalPages - 1, page + 1);
            await interaction.update(
              buildGivePetPayload(page, target.username),
            );
            return;
          }
          if (interaction.customId.startsWith("give_pet_")) {
            const petId = interaction.customId.replace("give_pet_", "");
            const petDef = petItems.get(petId);
            if (!petDef) return;

            const instanceId = createId();
            await db
              .insert(petInstance)
              .values({ id: instanceId, userId: target.id, petId });

            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: `${config.emojis.tick} Gave **${petDef.emoji} ${petDef.name}** to **${target.username}**.\nInstance ID: \`${instanceId}\``,
            });
            try {
              await message.edit(buildGivePetPayload(page, target.username));
            } catch {}
            return;
          }
        }
      });

      collector.on("end", async () => {
        try {
          await message.edit({ components: [] });
        } catch {}
      });
      return;
    }

    // ── give-item (interactive browser) ──────────────────────────────────
    if (sub === "give-item") {
      let category: DevCategory = "fish";
      let page = 0;

      const message = await ctx.editReply(
        buildGiveItemPayload(category, page, target.username),
      );

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === ctx.user.id,
        time: 120_000,
      });

      collector.on("collect", async (interaction) => {
        if (
          interaction.componentType === ComponentType.StringSelect &&
          interaction.customId === "give_cat"
        ) {
          category = interaction.values[0] as DevCategory;
          page = 0;
          await interaction.update(
            buildGiveItemPayload(category, page, target.username),
          );
          return;
        }

        if (interaction.componentType === ComponentType.Button) {
          if (interaction.customId === "give_prev") {
            page = Math.max(0, page - 1);
            await interaction.update(
              buildGiveItemPayload(category, page, target.username),
            );
            return;
          }
          if (interaction.customId === "give_next") {
            const items = getItemsByCategory(category);
            const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
            page = Math.min(totalPages - 1, page + 1);
            await interaction.update(
              buildGiveItemPayload(category, page, target.username),
            );
            return;
          }
          if (interaction.customId.startsWith("give_item_")) {
            const itemId = interaction.customId.replace("give_item_", "");
            const item = getItemsByCategory(category).find(
              (i) => i.id === itemId,
            );
            if (!item) return;

            const giveModal = new ModalBuilder()
              .setCustomId("give_qty_modal")
              .setTitle(`Give ${item.name}`)
              .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                  new TextInputBuilder()
                    .setCustomId("give_qty_input")
                    .setLabel("Quantity to give")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("1")
                    .setValue("1")
                    .setMinLength(1)
                    .setMaxLength(6)
                    .setRequired(true),
                ),
              );

            await interaction.showModal(giveModal);

            let modalI: any;
            try {
              modalI = await interaction.awaitModalSubmit({
                filter: (m: any) => m.user.id === ctx.user.id,
                time: 60_000,
              });
            } catch {
              return;
            }

            const rawQty = modalI.fields.getTextInputValue("give_qty_input");
            const qty = Math.max(1, parseInt(rawQty) || 1);
            const added = await addItem(target.id, itemId, item.category, qty);

            if (!added) {
              await modalI.reply({
                flags: MessageFlags.Ephemeral,
                content: `${config.emojis.cross} **${target.username}**'s sack is full.`,
              });
            } else {
              await modalI.reply({
                flags: MessageFlags.Ephemeral,
                content: `${config.emojis.tick} Gave **${qty}×** ${item.emoji} **${item.name}** to **${target.username}**.`,
              });
            }
            try {
              await message.edit(
                buildGiveItemPayload(category, page, target.username),
              );
            } catch {}
            return;
          }
        }
      });

      collector.on("end", async () => {
        try {
          await message.edit({ components: [] });
        } catch {}
      });
      return;
    }

    // ── inv-remove ───────────────────────────────────────────────────────
    if (sub === "inv-remove") {
      const itemId = args.getString("item", true);
      const qty = args.getInteger("qty", true);
      const item = allItems.get(itemId);
      const existing = await db
        .select()
        .from(fishingInventory)
        .where(
          and(
            eq(fishingInventory.userId, target.id),
            eq(fishingInventory.itemId, itemId),
          ),
        );

      if (!existing[0]) {
        return ctx.editReply({
          content: `${config.emojis.cross} **${target.username}** doesn't have that item.`,
        });
      }
      const removeQty = Math.min(qty, existing[0].quantity);
      if (existing[0].quantity <= removeQty) {
        await db
          .delete(fishingInventory)
          .where(eq(fishingInventory.id, existing[0].id));
      } else {
        await db
          .update(fishingInventory)
          .set({ quantity: existing[0].quantity - removeQty })
          .where(eq(fishingInventory.id, existing[0].id));
      }
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Item Removed`)
          .body(
            `Removed **${removeQty}×** ${item?.emoji ?? ""} **${item?.name ?? itemId}** from **${target.username}**'s sack.`,
          )
          .build() as any,
      );
    }

    // ── inv-set-qty ──────────────────────────────────────────────────────
    if (sub === "inv-set-qty") {
      const itemId = args.getString("item", true);
      const qty = args.getInteger("qty", true);
      const item = allItems.get(itemId);
      const existing = await db
        .select()
        .from(fishingInventory)
        .where(
          and(
            eq(fishingInventory.userId, target.id),
            eq(fishingInventory.itemId, itemId),
          ),
        );

      if (qty === 0) {
        if (existing[0])
          await db
            .delete(fishingInventory)
            .where(eq(fishingInventory.id, existing[0].id));
      } else if (existing[0]) {
        await db
          .update(fishingInventory)
          .set({ quantity: qty })
          .where(eq(fishingInventory.id, existing[0].id));
      } else {
        if (!item)
          return ctx.editReply({
            content: `${config.emojis.cross} Unknown item ID \`${itemId}\`.`,
          });
        await db
          .insert(fishingInventory)
          .values({
            id: createId(),
            userId: target.id,
            itemId,
            itemType: item.category,
            quantity: qty,
          });
      }
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Quantity Set`)
          .body(
            `Set **${item?.emoji ?? ""} ${item?.name ?? itemId}** → **${qty}** for **${target.username}**.`,
          )
          .build() as any,
      );
    }

    // ── inv-clear ────────────────────────────────────────────────────────
    if (sub === "inv-clear") {
      await db
        .delete(fishingInventory)
        .where(eq(fishingInventory.userId, target.id));
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Inventory Cleared`)
          .body(`**${target.username}**'s sack has been emptied.`)
          .build() as any,
      );
    }

    // ── buff-add ─────────────────────────────────────────────────────────
    if (sub === "buff-add") {
      const type = args.getString("type", true) as BuffType;
      const amount = args.getNumber("amount", true);
      const minutes = args.getInteger("minutes", true);
      await addBuff(target.id, [{ type, amount, durationMinutes: minutes }]);
      const sign = amount >= 0 ? "+" : "";
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Buff Added`)
          .body(
            `Added **${type.replace(/_/g, " ")}** ${sign}${Math.round(amount * 100)}% for **${minutes}min** to **${target.username}**.`,
          )
          .build() as any,
      );
    }

    // ── buff-clear ───────────────────────────────────────────────────────
    if (sub === "buff-clear") {
      await redis.del(BUFF_KEY(target.id));
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Buffs Cleared`)
          .body(`All active buffs removed from **${target.username}**.`)
          .build() as any,
      );
    }

    // ── buff-remove ──────────────────────────────────────────────────────
    if (sub === "buff-remove") {
      const type = args.getString("type", true) as BuffType;
      const removed = await removeBuffType(target.id, type);
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Buff Removed`)
          .body(
            `Removed **${removed}** \`${type}\` buff(s) from **${target.username}**.`,
          )
          .build() as any,
      );
    }

    // ── pet-remove ───────────────────────────────────────────────────────
    if (sub === "pet-remove") {
      const instanceId = args.getString("pet", true);
      const rows = await db
        .select()
        .from(petInstance)
        .where(eq(petInstance.id, instanceId));
      if (!rows[0] || rows[0].userId !== target.id) {
        return ctx.editReply({
          content: `${config.emojis.cross} Pet not found on **${target.username}**.`,
        });
      }
      const def = petItems.get(rows[0].petId);
      // Unequip if equipped
      const profile = await getOrCreateProfile(target.id);
      if (profile.equippedPets.includes(instanceId)) {
        await db
          .update(fishingProfile)
          .set({
            equippedPets: profile.equippedPets.filter(
              (id) => id !== instanceId,
            ),
          })
          .where(eq(fishingProfile.userId, target.id));
      }
      await db.delete(petInstance).where(eq(petInstance.id, instanceId));
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Pet Removed`)
          .body(
            `Deleted **${def?.emoji ?? "?"} ${rows[0].name ?? def?.name ?? "pet"}** from **${target.username}**.`,
          )
          .build() as any,
      );
    }

    // ── pet-set-level ────────────────────────────────────────────────────
    if (sub === "pet-set-level") {
      const instanceId = args.getString("pet", true);
      const level = args.getInteger("level", true);
      const rows = await db
        .select()
        .from(petInstance)
        .where(eq(petInstance.id, instanceId));
      if (!rows[0] || rows[0].userId !== target.id) {
        return ctx.editReply({
          content: `${config.emojis.cross} Pet not found on **${target.username}**.`,
        });
      }
      const def = petItems.get(rows[0].petId);
      await db
        .update(petInstance)
        .set({ petLevel: level })
        .where(eq(petInstance.id, instanceId));
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Pet Level Set`)
          .body(
            `**${def?.emoji ?? "?"} ${rows[0].name ?? def?.name ?? "pet"}** (${target.username}) → **Level ${level}**.`,
          )
          .build() as any,
      );
    }

    // ── leaderboard-toggle ───────────────────────────────────────────────
    if (sub === "leaderboard-toggle") {
      const profile = await getOrCreateProfile(target.id);
      const newValue = !profile.leaderboardHidden;
      await db
        .update(fishingProfile)
        .set({ leaderboardHidden: newValue })
        .where(eq(fishingProfile.userId, target.id));
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Leaderboard Updated`)
          .body(
            `**${target.username}** is now **${newValue ? "hidden from" : "visible on"}** the leaderboard.`,
          )
          .build() as any,
      );
    }

    // ── reset-user ───────────────────────────────────────────────────────
    if (sub === "reset-user") {
      await getOrCreateProfile(target.id);
      await db
        .update(fishingProfile)
        .set({
          coins: 0,
          xp: 0,
          level: 1,
          sackLevel: 1,
          equippedRodId: "splintered_twig",
          equippedBaitId: null,
          equippedPets: [],
          totalCatches: 0,
          equippedRodDurability: null,
          hutOwned: false,
          leaderboardHidden: false,
        })
        .where(eq(fishingProfile.userId, target.id));
      await db
        .delete(fishingInventory)
        .where(eq(fishingInventory.userId, target.id));
      await db.delete(petInstance).where(eq(petInstance.userId, target.id));
      await db.delete(hut).where(eq(hut.userId, target.id));
      await redis.del(BUFF_KEY(target.id));
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`⚠️ User Reset`)
          .body(
            `**${target.username}** has been fully reset.\nProfile · Inventory · Pets · Hut · Buffs all cleared.`,
          )
          .build() as any,
      );
    }

    // ── ban ──────────────────────────────────────────────────────────────
    if (sub === "ban") {
      const reason = args.getString("reason") ?? undefined;
      await banUser(target.id, ctx.user.id, reason);
      return ctx.editReply(
        ui()
          .color(config.colors.error)
          .title(`${config.emojis.mod} User Banned`)
          .body(
            `**${target.username}** (\`${target.id}\`) has been permanently banned.${reason ? `\n**Reason:** ${reason}` : ""}`,
          )
          .build() as any,
      );
    }

    // ── timeout ──────────────────────────────────────────────────────────
    if (sub === "timeout") {
      const durationStr = args.getString("duration", true);
      const reason = args.getString("reason") ?? undefined;
      const ms = parseDuration(durationStr);
      if (!ms) {
        return ctx.editReply({
          content: `${config.emojis.cross} Invalid duration. Use \`30s\`, \`10m\`, \`2h\`, \`1d\`, or \`1w\`.`,
        });
      }
      const expiresAt = new Date(Date.now() + ms);
      await timeoutUser(target.id, ctx.user.id, ms, reason);
      return ctx.editReply(
        ui()
          .color(config.colors.warn)
          .title(`${config.emojis.mod} User Timed Out`)
          .body(
            `**${target.username}** (\`${target.id}\`) timed out for **${formatDuration(ms)}**.\nExpires: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>${reason ? `\n**Reason:** ${reason}` : ""}`,
          )
          .build() as any,
      );
    }

  },
} as Command;
