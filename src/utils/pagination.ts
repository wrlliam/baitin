import { ExtendedInteraction } from "@/core/typings";
import { UIPayload } from "@/ui";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChatInputCommandInteraction,
  MessageComponentInteraction,
  RepliableInteraction,
  Message,
} from "discord.js";

export interface PaginationPage {
  payload: UIPayload;
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
  time: number = 60000,
) {
  if (!pages || pages.length === 0)
    throw new Error("Pages array cannot be empty.");

  let currentPage = 0;
  const hasLabels = pages.some((page) => page.label !== undefined);

  const getNavRows = (): ActionRowBuilder<any>[] => {
    const rows: ActionRowBuilder<any>[] = [];

    const atStart = currentPage === 0;
    const atEnd = currentPage === pages.length - 1;

    const userId = interaction.user.id;
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`page_start_${userId}`)
        .setEmoji("⏮️")
        .setStyle(atStart ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(atStart),
      new ButtonBuilder()
        .setCustomId(`page_back_${userId}`)
        .setEmoji("◀️")
        .setStyle(atStart ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(atStart),
      new ButtonBuilder()
        .setCustomId(`page_forward_${userId}`)
        .setEmoji("▶️")
        .setStyle(atEnd ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(atEnd),
      new ButtonBuilder()
        .setCustomId(`page_finish_${userId}`)
        .setEmoji("⏭️")
        .setStyle(atEnd ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(atEnd),
    );

    if (hasLabels) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`page_select_${userId}`)
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

      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          selectMenu,
        ),
      );
    }

    rows.push(buttonRow);
    return rows;
  };

  const buildReplyPayload = () => {
    const navRows = getNavRows();
    const page = pages[currentPage].payload;
    return {
      flags: page.flags,
      components: [...page.components, ...navRows],
    };
  };

  const initialPayload = buildReplyPayload();

  let message: Message;
  if (interaction.deferred || interaction.replied) {
    message = (await interaction.editReply(initialPayload as any)) as Message;
  } else {
    await interaction.reply(initialPayload as any);
    message = (await interaction.fetchReply()) as Message;
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
      if (i.customId.startsWith("page_start_")) {
        currentPage = 0;
      } else if (i.customId.startsWith("page_back_")) {
        currentPage--;
      } else if (i.customId.startsWith("page_forward_")) {
        currentPage++;
      } else if (i.customId.startsWith("page_finish_")) {
        currentPage = pages.length - 1;
      }
    } else if (i.isStringSelectMenu()) {
      if (i.customId.startsWith("page_select_")) {
        currentPage = parseInt(i.values[0], 10);
      }
    }

    await interaction.editReply(buildReplyPayload() as any);
    collector.resetTimer();
  });

  collector.on("end", async (_, reason) => {
    if (reason !== "messageDelete") {
      await interaction
        .editReply({ components: [] })
        .catch(() => null);
    }
  });
}
