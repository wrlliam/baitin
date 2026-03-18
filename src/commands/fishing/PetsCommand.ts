import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { petItems, eggItems } from "@/data";
import {
  equipPet,
  unequipPet,
  renamePet,
  getUserPets,
  upgradePet,
  startIncubation,
  getIncubatingEggs,
  collectHatch,
} from "@/modules/fishing/pets";
import { getInventory } from "@/modules/fishing/inventory";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
} from "discord.js";

export default {
  name: "pets",
  description: "Manage your pets.",
  type: ApplicationCommandType.ChatInput,
  usage: [
    "/pets list",
    "/pets incubate <egg>",
    "/pets collect <slot>",
    "/pets equip",
    "/pets unequip",
    "/pets rename",
    "/pets upgrade",
  ],
  options: [
    {
      name: "list",
      description: "List all your pets.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [],
    },
    {
      name: "incubate",
      description: "Place an egg in the incubator to hatch over time.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "egg",
          description: "The egg to incubate.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "collect",
      description: "Collect a hatched egg from the incubator.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "slot",
          description: "The incubator slot to collect from.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "equip",
      description: "Equip a pet (max 3).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "pet",
          description: "The pet instance to equip.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "unequip",
      description: "Unequip a pet.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "pet",
          description: "The pet instance to unequip.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "rename",
      description: "Rename a pet.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "pet",
          description: "The pet to rename.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "name",
          description: "The new name.",
          type: ApplicationCommandOptionType.String,
          required: true,
          maxLength: 32,
        },
      ],
    },
    {
      name: "upgrade",
      description:
        "Upgrade a pet (costs 500 × current level coins, max level 10).",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "pet",
          description: "The pet to upgrade.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
  ],
  autocomplete: async ({ ctx }) => {
    const sub = ctx.options.getSubcommand();
    const focused = ctx.options.getFocused(true);
    const value = (focused.value as string).toLowerCase();

    if (sub === "incubate") {
      const inventory = await getInventory(ctx.user.id);
      const eggs = inventory.filter((i) => i.itemType === "egg");
      return ctx.respond(
        eggs
          .map((i) => {
            const egg = eggItems.get(i.itemId);
            return egg
              ? {
                  name: `${egg.emoji} ${egg.name} ×${i.quantity} (${egg.hatchTimeMinutes}m hatch)`,
                  value: egg.id,
                }
              : null;
          })
          .filter(Boolean)
          .filter((c) => c!.name.toLowerCase().includes(value))
          .slice(0, 25) as { name: string; value: string }[],
      );
    }

    if (sub === "collect") {
      const incubating = await getIncubatingEggs(ctx.user.id);
      const now = Date.now();
      return ctx.respond(
        incubating
          .map((slot) => {
            const egg = eggItems.get(slot.eggId);
            const ready = now >= slot.hatchesAt.getTime();
            const label = egg
              ? `${egg.emoji} ${egg.name} — ${ready ? "READY!" : `${Math.ceil((slot.hatchesAt.getTime() - now) / 60000)}m left`}`
              : slot.id.slice(0, 8);
            return { name: label, value: slot.id };
          })
          .filter((c) => c.name.toLowerCase().includes(value))
          .slice(0, 25),
      );
    }

    const pets = await getUserPets(ctx.user.id);
    return ctx.respond(
      pets
        .map((p) => {
          const pet = petItems.get(p.petId);
          const label = pet
            ? `${pet.emoji} ${p.name ?? pet.name} (Lv ${p.petLevel})`
            : p.id;
          return { name: label, value: p.id };
        })
        .filter((c) => c.name.toLowerCase().includes(value))
        .slice(0, 25),
    );
  },
  run: async ({ args, client, ctx }) => {
    const sub = args.getSubcommand();

    if (sub === "list") {
      const [pets, incubating] = await Promise.all([
        getUserPets(ctx.user.id),
        getIncubatingEggs(ctx.user.id),
      ]);

      const builder = ui().color(config.colors.default).title("🐾 Your Pets");

      if (pets.length === 0 && incubating.length === 0) {
        builder.text(
          "You don't have any pets yet. Buy an egg from `/shop` and `/pets incubate` it!",
        );
        return ctx.editReply(builder.build() as any);
      }

      if (pets.length > 0) {
        const lines = pets.map((p) => {
          const pet = petItems.get(p.petId);
          if (!pet) return `\`${p.id.slice(0, 8)}\` Unknown pet`;
          const buffDesc = pet.buffs
            .map(
              (b) =>
                `+${Math.round(b.value * 100)}% ${b.type.replace(/_/g, " ")}`,
            )
            .join(", ");
          return `${pet.emoji} **${p.name ?? pet.name}** — Lv ${p.petLevel} — ${buffDesc} \`[${p.id.slice(0, 8)}]\``;
        });
        builder.text(lines.join("\n"));
      }

      if (incubating.length > 0) {
        builder.divider().text("**🥚 Incubating**");
        const now = Date.now();
        const incLines = incubating.map((slot) => {
          const egg = eggItems.get(slot.eggId);
          const name = egg ? `${egg.emoji} ${egg.name}` : slot.eggId;
          const ready = now >= slot.hatchesAt.getTime();
          const status = ready
            ? "**READY!** Use `/pets collect`"
            : `${Math.ceil((slot.hatchesAt.getTime() - now) / 60000)}m remaining`;
          return `${name} — ${status}`;
        });
        builder.text(incLines.join("\n"));
      }

      builder.footer("Use /pets incubate to start hatching eggs");
      return ctx.editReply(builder.build() as any);
    }

    if (sub === "incubate") {
      const eggId = args.getString("egg", true);
      const egg = eggItems.get(eggId);

      const result = await startIncubation(ctx.user.id, eggId);
      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      const hatchTs = Math.floor(result.hatchesAt!.getTime() / 1000);

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title("🥚 Egg Incubating!")
          .text(
            `${egg?.emoji ?? "🥚"} **${egg?.name ?? eggId}** is now in the incubator.\n\nReady <t:${hatchTs}:R> (<t:${hatchTs}:t>)${egg && egg.failChance > 0 ? `\n\n⚠️ This egg has a **${Math.round(egg.failChance * 100)}%** chance of cracking!` : ""}`,
          )
          .footer("Use /pets collect when it's ready • /pets list to check status")
          .build() as any,
      );
    }

    if (sub === "collect") {
      const slotId = args.getString("slot", true);

      await ctx.editReply({ content: "✨ The egg begins to crack..." });
      await new Promise((r) => setTimeout(r, 1500));

      const result = await collectHatch(ctx.user.id, slotId);

      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      if (result.failed) {
        return ctx.editReply(
          ui()
            .color(config.colors.default)
            .title("💔 Hatch Failed!")
            .text(
              "The egg cracked and shattered... nothing survived. Better luck next time.",
            )
            .footer("Some eggs have a natural failure chance")
            .build() as any,
        );
      }

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${result.petEmoji} A wild ${result.petName} hatched!`)
          .text(
            `You now own a **${result.petName}**! Use \`/pets equip\` to equip it.`,
          )
          .build() as any,
      );
    }

    if (sub === "equip") {
      const petInstanceId = args.getString("pet", true);
      const result = await equipPet(ctx.user.id, petInstanceId);
      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }
      return ctx.editReply({ content: `${config.emojis.tick} Pet equipped!` });
    }

    if (sub === "unequip") {
      const petInstanceId = args.getString("pet", true);
      const result = await unequipPet(ctx.user.id, petInstanceId);
      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }
      return ctx.editReply({
        content: `${config.emojis.tick} Pet unequipped.`,
      });
    }

    if (sub === "rename") {
      const petInstanceId = args.getString("pet", true);
      const newName = args.getString("name", true);
      const result = await renamePet(ctx.user.id, petInstanceId, newName);
      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }
      return ctx.editReply({
        content: `${config.emojis.tick} Pet renamed to **${newName}**.`,
      });
    }

    if (sub === "upgrade") {
      const petInstanceId = args.getString("pet", true);
      const pets = await getUserPets(ctx.user.id);
      const p = pets.find((pet) => pet.id === petInstanceId);
      if (!p)
        return ctx.editReply({
          content: `${config.emojis.cross} Pet not found.`,
        });

      const currentLevel = p.petLevel ?? 1;
      const cost = 500 * currentLevel;
      const petDef = petItems.get(p.petId);

      const result = await upgradePet(ctx.user.id, petInstanceId);
      if (!result.success) {
        return ctx.editReply({
          content: `${config.emojis.cross} ${result.error}`,
        });
      }

      const newLevelScalar = 1 + result.newLevel! * 0.1;
      const buffPreview = petDef
        ? petDef.buffs
            .map(
              (b) =>
                `+${Math.round(b.value * newLevelScalar * 100)}% ${b.type.replace(/_/g, " ")}`,
            )
            .join(", ")
        : "";

      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.tick} Pet Upgraded!`)
          .body(
            `**${petDef?.emoji ?? ""} ${p.name ?? petDef?.name ?? "Pet"}** is now **Level ${result.newLevel}**.\nNew buffs: ${buffPreview}`,
          )
          .footer(`Cost: ${cost.toLocaleString()} coins`)
          .build() as any,
      );
    }
  },
} as Command;
