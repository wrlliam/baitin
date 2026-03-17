import { ExtendedInteraction } from "@/core/typings";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  RepliableInteraction,
  Message,
} from "discord.js";

export interface PaginationPage {
  embed: EmbedBuilder | any;
  label?: string;
  description?: string;
  emoji?: string;
}

export async function paginate(
  interaction:
    | ExtendedInteraction
    | ChatInputCommandInteraction
    | RepliableInteraction,
  pages: PaginationPage[],
  time: number = 60000, //  60 seconds
) {
  if (!pages || pages.length === 0)
    throw new Error("Pages array cannot be empty.");

  let currentPage = 0;
  const hasLabels = pages.some((page) => page.label !== undefined);

  const getComponents = () => {
    const rows: ActionRowBuilder<any>[] = [];

    const atStart = currentPage === 0;
    const atEnd = currentPage === pages.length - 1;

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("page_start")
        .setEmoji("⏮️")
        .setStyle(atStart ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(atStart),
      new ButtonBuilder()
        .setCustomId("page_back")
        .setEmoji("◀️")
        .setStyle(atStart ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(atStart),
      new ButtonBuilder()
        .setCustomId("page_forward")
        .setEmoji("▶️")
        .setStyle(atEnd ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(atEnd),
      new ButtonBuilder()
        .setCustomId("page_finish")
        .setEmoji("⏭️")
        .setStyle(atEnd ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(atEnd),
    );

    if (hasLabels) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("page_select")
        .setPlaceholder("Navigate to a specific category...")
        .addOptions(
          pages.map((page, index) => {
            const option = new StringSelectMenuOptionBuilder()
              .setLabel(page.label || `Page ${index + 1}`)
              .setValue(index.toString())
              .setDefault(index === currentPage);

            if (page.description) option.setDescription(page.description);
            if (page.emoji) option.setEmoji(page.emoji);

            return option;
          }),
        );

      const selectRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          selectMenu,
        );
      rows.push(selectRow);
    }

    rows.push(buttonRow);
    return rows;
  };

  const initialPayload = {
    embeds: [pages[currentPage].embed],
    components: getComponents(),
    withResponse: true,
  };

  let message: Message;
  if (interaction.deferred || interaction.replied) {
    message = (await interaction.editReply(initialPayload)) as Message;
  } else {
    message = (await interaction.reply(initialPayload)) as unknown as Message;
  }

  if (pages.length === 1) return;

  const collector = message.createMessageComponentCollector({
    filter: (i: MessageComponentInteraction) =>
      i.user.id === interaction.user.id,
    time: time,
  });

  collector.on("collect", async (i: MessageComponentInteraction) => {
    await i.deferUpdate();

    if (i.isButton()) {
      switch (i.customId) {
        case "page_start":
          currentPage = 0;
          break;
        case "page_back":
          currentPage--;
          break;
        case "page_forward":
          currentPage++;
          break;
        case "page_finish":
          currentPage = pages.length - 1;
          break;
      }
    } else if (i.isStringSelectMenu()) {
      if (i.customId === "page_select") {
        currentPage = parseInt(i.values[0], 10);
      }
    }

    await interaction.editReply({
      embeds: [pages[currentPage].embed],
      components: getComponents(),
    });

    collector.resetTimer();
  });

  collector.on("end", async (_, reason) => {
    if (reason !== "messageDelete") {
      await interaction
        .editReply({
          components: [],
        })
        .catch(() => null);
    }
  });
}
