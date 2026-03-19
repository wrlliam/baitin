import config from "@/config";
import { ui, btn, ButtonStyle } from "@/ui";
import { Command } from "@/core/typings";
import { redis } from "@/db/redis";
import {
  fishItems,
  junkItems,
  rodItems,
  baitItems,
  petItems,
  eggItems,
  potionItems,
  allItems,
} from "@/data";
import type { Fish, JunkItem, Rod, Bait, Pet, Egg, Potion, BaseItem } from "@/data/types";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle as DjsButtonStyle,
  ComponentType,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

// ─── Wiki Categories ─────────────────────────────────────────────────────────

type WikiCategory = "fish" | "junk" | "rod" | "bait" | "pet" | "egg" | "potion";

const WIKI_CATEGORIES: Record<WikiCategory, { label: string; emoji: string; desc: string }> = {
  fish: { label: "Fish", emoji: config.emojis.fish, desc: "All catchable fish" },
  junk: { label: "Junk", emoji: config.emojis.junk, desc: "Junk items from fishing" },
  rod: { label: "Rods", emoji: config.emojis.rod, desc: "Fishing rods and upgrades" },
  bait: { label: "Bait", emoji: config.emojis.bait, desc: "Bait types and effects" },
  pet: { label: "Pets", emoji: config.emojis.pet, desc: "Companion pets and buffs" },
  egg: { label: "Eggs", emoji: config.emojis.egg, desc: "Hatchable pet eggs" },
  potion: { label: "Potions", emoji: config.emojis.potion, desc: "Consumable potions" },
};

const CATEGORY_ORDER: WikiCategory[] = ["fish", "junk", "rod", "bait", "pet", "egg", "potion"];

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const RARITY_EMOJI: Record<string, string> = {
  common: "⬜",
  uncommon: "🟩",
  rare: "🟦",
  epic: "🟪",
  legendary: "🟧",
  mythic: "🟥",
};

function getCategoryItems(cat: WikiCategory): { id: string; name: string; emoji: string; rarity: string }[] {
  let items: { id: string; name: string; emoji: string; rarity: string }[];
  switch (cat) {
    case "fish": items = [...fishItems.values()]; break;
    case "junk": items = [...junkItems.values()]; break;
    case "rod": items = [...rodItems.values()]; break;
    case "bait": items = [...baitItems.values()]; break;
    case "pet": items = [...petItems.values()]; break;
    case "egg": items = [...eggItems.values()]; break;
    case "potion": items = [...potionItems.values()]; break;
  }
  return items.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
}

// ─── Item Detail Builders ────────────────────────────────────────────────────

function rarityLabel(r: string): string {
  return `${RARITY_EMOJI[r] ?? "⬜"} ${r.charAt(0).toUpperCase() + r.slice(1)}`;
}

function buildFishDetail(item: Fish) {
  return ui()
    .color(config.colors.default)
    .title(`${item.emoji} ${item.name}`)
    .quote(item.description)
    .divider()
    .text(
      `**Rarity:** ${rarityLabel(item.rarity)}\n` +
      `**Sell Price:** ${item.price.toLocaleString()} ${config.emojis.coin}\n` +
      `**Weight:** ${item.weight.toLocaleString()}\n` +
      `**XP:** ${item.xp}`,
    )
    .text(
      (item.pros.length > 0 ? `✅ ${item.pros.join(" • ")}` : "") +
      (item.cons.length > 0 ? `\n❌ ${item.cons.join(" • ")}` : ""),
    )
    .footer("Baitin Wiki • /wiki")
    .build();
}

function buildJunkDetail(item: JunkItem) {
  return ui()
    .color(config.colors.default)
    .title(`${item.emoji} ${item.name}`)
    .quote(item.description)
    .divider()
    .text(
      `**Rarity:** ${rarityLabel(item.rarity)}\n` +
      `**Sell Price:** ${item.price.toLocaleString()} ${config.emojis.coin}\n` +
      `**Weight:** ${item.weight.toLocaleString()}`,
    )
    .text(
      (item.pros.length > 0 ? `✅ ${item.pros.join(" • ")}` : "") +
      (item.cons.length > 0 ? `\n❌ ${item.cons.join(" • ")}` : ""),
    )
    .footer("Baitin Wiki • /wiki")
    .build();
}

function buildRodDetail(item: Rod) {
  return ui()
    .color(config.colors.default)
    .title(`${item.emoji} ${item.name}`)
    .quote(item.description)
    .divider()
    .text(
      `**Rarity:** ${rarityLabel(item.rarity)}\n` +
      `**Buy Price:** ${item.buyPrice.toLocaleString()} ${config.emojis.coin}\n` +
      `**Sell Price:** ${item.price.toLocaleString()} ${config.emojis.coin}\n` +
      `**Luck Bonus:** +${(item.luckBonus * 100).toFixed(1)}%\n` +
      `**Speed Bonus:** -${item.speedReduction}s cooldown\n` +
      `**Durability:** ${item.durability === 0 ? "Unbreakable" : `${item.durability} casts`}`,
    )
    .footer("Baitin Wiki • /wiki")
    .build();
}

function buildBaitDetail(item: Bait) {
  return ui()
    .color(config.colors.default)
    .title(`${item.emoji} ${item.name}`)
    .quote(item.description)
    .divider()
    .text(
      `**Rarity:** ${rarityLabel(item.rarity)}\n` +
      `**Buy Price:** ${item.buyPrice.toLocaleString()} ${config.emojis.coin}\n` +
      `**Sell Price:** ${item.price.toLocaleString()} ${config.emojis.coin}\n` +
      `**Rarity Multiplier:** ×${item.rarityMultiplier.toFixed(2)}\n` +
      `**Junk Modifier:** ${item.junkModifier > 0 ? "+" : ""}${(item.junkModifier * 100).toFixed(0)}%\n` +
      `**Consumed on Use:** ${item.consumedOnUse ? "Yes" : "No"}`,
    )
    .footer("Baitin Wiki • /wiki")
    .build();
}

function buildPetDetail(item: Pet) {
  const buffLines = item.buffs.map((b) => {
    const label = b.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `${config.emojis[b.type] ?? "📊"} **${label}:** +${(b.value * 100).toFixed(1)}%`;
  });

  return ui()
    .color(config.colors.default)
    .title(`${item.emoji} ${item.name}`)
    .quote(item.description)
    .divider()
    .text(
      `**Rarity:** ${rarityLabel(item.rarity)}\n\n` +
      `**Buffs:**\n${buffLines.join("\n")}`,
    )
    .text(
      (item.pros.length > 0 ? `✅ ${item.pros.join(" • ")}` : "") +
      (item.cons.length > 0 ? `\n❌ ${item.cons.join(" • ")}` : ""),
    )
    .footer("Baitin Wiki • /wiki")
    .build();
}

function buildEggDetail(item: Egg) {
  const possiblePetNames = item.possiblePets
    .map((pid) => petItems.get(pid))
    .filter(Boolean)
    .map((p) => `${p!.emoji} ${p!.name} (${rarityLabel(p!.rarity)})`)
    .join("\n");

  const hours = Math.floor(item.hatchTimeMinutes / 60);
  const mins = item.hatchTimeMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return ui()
    .color(config.colors.default)
    .title(`${item.emoji} ${item.name}`)
    .quote(item.description)
    .divider()
    .text(
      `**Rarity:** ${rarityLabel(item.rarity)}\n` +
      `**Price:** ${item.price.toLocaleString()} ${config.emojis.coin}\n` +
      `**Hatch Time:** ${timeStr}\n` +
      `**Fail Chance:** ${(item.failChance * 100).toFixed(0)}%\n\n` +
      `**Possible Pets:**\n${possiblePetNames || "None"}`,
    )
    .footer("Baitin Wiki • /wiki")
    .build();
}

function buildPotionDetail(item: Potion) {
  const effectLines = item.effects.map((e) => {
    const label = e.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const sign = e.amount >= 0 ? "+" : "";
    return `${config.emojis[e.type] ?? "📊"} **${label}:** ${sign}${(e.amount * 100).toFixed(0)}% for ${e.durationMinutes}m`;
  });

  return ui()
    .color(config.colors.default)
    .title(`${item.emoji} ${item.name}`)
    .quote(item.description)
    .divider()
    .text(
      `**Rarity:** ${rarityLabel(item.rarity)}\n` +
      `**Price:** ${item.price.toLocaleString()} ${config.emojis.coin}\n\n` +
      `**Effects:**\n${effectLines.join("\n")}`,
    )
    .footer("Baitin Wiki • /wiki")
    .build();
}

function buildItemDetail(itemId: string) {
  const fish = fishItems.get(itemId);
  if (fish) return buildFishDetail(fish);
  const junk = junkItems.get(itemId);
  if (junk) return buildJunkDetail(junk);
  const rod = rodItems.get(itemId);
  if (rod) return buildRodDetail(rod);
  const bait = baitItems.get(itemId);
  if (bait) return buildBaitDetail(bait);
  const pet = petItems.get(itemId);
  if (pet) return buildPetDetail(pet);
  const egg = eggItems.get(itemId);
  if (egg) return buildEggDetail(egg);
  const potion = potionItems.get(itemId);
  if (potion) return buildPotionDetail(potion);
  return null;
}

// ─── Recently Viewed ─────────────────────────────────────────────────────────

const RECENT_KEY = (userId: string) => `wiki:recent:${userId}`;
const MAX_RECENT = 10;

async function addRecent(userId: string, itemId: string) {
  const key = RECENT_KEY(userId);
  // Remove if already present, then prepend
  await redis.lrem(key, 0, itemId);
  await redis.lpush(key, itemId);
  await redis.ltrim(key, 0, MAX_RECENT - 1);
  await redis.expire(key, 60 * 60 * 24 * 7); // 7 days
}

async function getRecent(userId: string): Promise<string[]> {
  return redis.lrange(RECENT_KEY(userId), 0, MAX_RECENT - 1);
}

// ─── Page Builders ───────────────────────────────────────────────────────────

function buildCategorySelect(activeCat?: WikiCategory) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("wiki:cat")
      .setPlaceholder("Choose a category...")
      .addOptions(
        CATEGORY_ORDER.map((key) => {
          const meta = WIKI_CATEGORIES[key];
          const opt = new StringSelectMenuOptionBuilder()
            .setLabel(meta.label)
            .setDescription(meta.desc)
            .setValue(key)
            .setEmoji(meta.emoji.startsWith("<") ? { id: meta.emoji.match(/:(\d+)>/)?.[1] ?? undefined } : { name: meta.emoji });
          if (key === activeCat) opt.setDefault(true);
          return opt;
        }),
      ),
  );
}

const ITEMS_PER_PAGE = 10;

function buildCategoryPage(cat: WikiCategory, page: number) {
  const items = getCategoryItems(cat);
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const pageItems = items.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE);
  const meta = WIKI_CATEGORIES[cat];

  const builder = ui()
    .color(config.colors.default)
    .title(`${meta.emoji} Wiki — ${meta.label}`)
    .quote(`${items.length} items • Page ${safePage + 1}/${totalPages}`)
    .divider();

  for (const item of pageItems) {
    builder.section(
      `${item.emoji} **${item.name}**\n${RARITY_EMOJI[item.rarity] ?? "⬜"} ${item.rarity}`,
      btn("View", `wiki:view:${item.id}`, ButtonStyle.Secondary),
    );
  }

  builder.footer("Baitin Wiki • Select an item to view details");

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`wiki:page:${cat}:${safePage - 1}`)
      .setLabel("◀ Prev")
      .setStyle(DjsButtonStyle.Secondary)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`wiki:page:${cat}:${safePage + 1}`)
      .setLabel("Next ▶")
      .setStyle(DjsButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId("wiki:home")
      .setLabel("Home")
      .setStyle(DjsButtonStyle.Primary),
  );

  return builder.build({ rows: [buildCategorySelect(cat), navRow] });
}

function buildHomePage() {
  const builder = ui()
    .color(config.colors.default)
    .title(`${config.emojis.help} Baitin Wiki`)
    .quote("Browse info about fish, items, pets, and more!")
    .divider();

  for (const key of CATEGORY_ORDER) {
    const meta = WIKI_CATEGORIES[key];
    const count = getCategoryItems(key).length;
    builder.text(`${meta.emoji} **${meta.label}** — ${count} items`);
  }

  builder.footer("Select a category below or use /wiki [search] to find items");

  const homeNav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiki:recent")
      .setLabel("Recently Viewed")
      .setStyle(DjsButtonStyle.Secondary)
      .setEmoji("🕐"),
  );

  return builder.build({ rows: [buildCategorySelect(), homeNav] });
}

function buildRecentPage(recentIds: string[]) {
  const builder = ui()
    .color(config.colors.default)
    .title(`${config.emojis.help} Recently Viewed`)
    .divider();

  if (recentIds.length === 0) {
    builder.text("You haven't viewed any wiki items yet.\nUse `/wiki` to browse or `/wiki [search]` to find items!");
  } else {
    for (const id of recentIds) {
      // Try all maps
      const item = allItems.get(id) ?? petItems.get(id);
      if (!item) continue;
      builder.section(
        `${item.emoji} **${item.name}**\n${RARITY_EMOJI[item.rarity] ?? "⬜"} ${item.rarity}`,
        btn("View", `wiki:view:${item.id}`, ButtonStyle.Secondary),
      );
    }
  }

  builder.footer("Baitin Wiki • Your recently viewed items");

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiki:home")
      .setLabel("Home")
      .setStyle(DjsButtonStyle.Primary),
  );

  return builder.build({ rows: [buildCategorySelect(), navRow] });
}

// ─── Search ──────────────────────────────────────────────────────────────────

function searchItems(query: string): { id: string; name: string; emoji: string; rarity: string; category: string }[] {
  const q = query.toLowerCase();
  const results: { id: string; name: string; emoji: string; rarity: string; category: string }[] = [];

  for (const item of allItems.values()) {
    if (item.name.toLowerCase().includes(q) || item.id.includes(q)) {
      results.push({ id: item.id, name: item.name, emoji: item.emoji, rarity: item.rarity, category: item.category });
    }
  }
  // Also search pets (not in allItems)
  for (const pet of petItems.values()) {
    if (pet.name.toLowerCase().includes(q) || pet.id.includes(q)) {
      results.push({ id: pet.id, name: pet.name, emoji: pet.emoji, rarity: pet.rarity, category: "pet" });
    }
  }

  return results.slice(0, 25);
}

// ─── Command ─────────────────────────────────────────────────────────────────

export default {
  name: "wiki",
  description: "Browse the Baitin Wiki — fish, items, pets, and more.",
  usage: ["/wiki", "/wiki [search]"],
  type: ApplicationCommandType.ChatInput,
  defer: "none",
  options: [
    {
      name: "search",
      description: "Search for an item by name",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: false,
    },
  ],
  autocomplete: ({ ctx }) => {
    const focused = ctx.options.getFocused();
    if (!focused || focused.length < 1) {
      // Show popular items
      const popular = [...fishItems.values()].slice(0, 10).map((f) => ({
        name: `${f.emoji} ${f.name}`,
        value: f.id,
      }));
      return ctx.respond(popular);
    }

    const results = searchItems(focused);
    ctx.respond(
      results.map((r) => ({
        name: `${r.emoji} ${r.name} (${r.category})`,
        value: r.id,
      })),
    );
  },
  run: async ({ args, ctx }) => {
    const searchQuery = args.getString("search");

    // Direct item lookup
    if (searchQuery) {
      const detail = buildItemDetail(searchQuery);
      if (detail) {
        await addRecent(ctx.user.id, searchQuery);
        return ctx.reply(detail as any);
      }

      // Try fuzzy search
      const results = searchItems(searchQuery);
      if (results.length === 1) {
        const detail = buildItemDetail(results[0].id);
        if (detail) {
          await addRecent(ctx.user.id, results[0].id);
          return ctx.reply(detail as any);
        }
      }

      if (results.length > 1) {
        const builder = ui()
          .color(config.colors.default)
          .title(`${config.emojis.search} Search Results`)
          .quote(`Found ${results.length} items matching "${searchQuery}"`)
          .divider();

        for (const r of results.slice(0, 10)) {
          builder.section(
            `${r.emoji} **${r.name}**\n${RARITY_EMOJI[r.rarity] ?? "⬜"} ${r.rarity} • ${r.category}`,
            btn("View", `wiki:view:${r.id}`, ButtonStyle.Secondary),
          );
        }

        builder.footer("Baitin Wiki • Click View for details");

        const { resource } = await ctx.reply({
          ...builder.build(),
          withResponse: true,
        } as any);
        const reply = resource!.message!;

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 5 * 60 * 1000,
          filter: (i) => i.user.id === ctx.user.id,
        });

        collector.on("collect", async (i) => {
          const [, action, itemId] = i.customId.split(":");
          if (action === "view" && itemId) {
            const detail = buildItemDetail(itemId);
            if (detail) {
              await addRecent(ctx.user.id, itemId);
              await i.reply({
                ...detail,
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                components: detail.components,
              } as any);
            } else {
              await i.deferUpdate();
            }
          }
        });

        return;
      }

      return ctx.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: ui()
          .color(config.colors.error)
          .title(`${config.emojis.cross} Not Found`)
          .body(`No item matching \`${searchQuery}\` found. Try \`/wiki\` to browse all categories.`)
          .build().components,
      } as any);
    }

    // Interactive browser
    const homePayload = buildHomePage();

    const { resource } = await ctx.reply({
      ...homePayload,
      withResponse: true,
    } as any);
    const reply = resource!.message!;

    const collector = reply.createMessageComponentCollector({
      time: 5 * 60 * 1000,
      filter: (i) => i.user.id === ctx.user.id,
    });

    collector.on("collect", async (i) => {
      if (i.isStringSelectMenu() && i.customId === "wiki:cat") {
        const cat = i.values[0] as WikiCategory;
        await i.update(buildCategoryPage(cat, 0) as any);
        return;
      }

      if (!i.isButton()) return;

      const parts = i.customId.split(":");
      const action = parts[1];

      if (action === "home") {
        await i.update(buildHomePage() as any);
      } else if (action === "recent") {
        const recent = await getRecent(ctx.user.id);
        await i.update(buildRecentPage(recent) as any);
      } else if (action === "page") {
        const cat = parts[2] as WikiCategory;
        const page = parseInt(parts[3], 10);
        await i.update(buildCategoryPage(cat, page) as any);
      } else if (action === "view") {
        const itemId = parts[2];
        const detail = buildItemDetail(itemId);
        if (detail) {
          await addRecent(ctx.user.id, itemId);
          await i.reply({
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: detail.components,
          } as any);
        } else {
          await i.deferUpdate();
        }
      }
    });

    collector.on("end", async () => {
      await reply.edit({
        components: [],
      }).catch(() => {});
    });
  },
} as Command;
