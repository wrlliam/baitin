import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { env } from "@/env";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import {
  ApplicationCommandType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from "discord.js";

const COOLDOWN_SECS = 3600; // 1 suggestion per hour

export default {
  name: "suggestion",
  description: "Submit a suggestion or feedback for the bot.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/suggestion"],
  defer: "none",
  options: [],
  run: async ({ client, ctx }) => {
    const userId = ctx.user.id;

    // Cooldown check
    const cooldown = await checkCooldown(userId, "suggestion");
    if (!cooldown.ok) {
      return ctx.reply({
        ...ui()
          .color(config.colors.warn)
          .title(`${config.emojis.cooldown} Slow Down`)
          .body(
            `You already submitted a suggestion recently. You can submit again <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    // Show modal
    const modal = new ModalBuilder()
      .setCustomId(`suggestion_modal_${userId}`)
      .setTitle("Submit a Suggestion");

    const titleInput = new TextInputBuilder()
      .setCustomId("suggestion_title")
      .setLabel("Title")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Brief summary of your suggestion")
      .setMinLength(5)
      .setMaxLength(100)
      .setRequired(true);

    const bodyInput = new TextInputBuilder()
      .setCustomId("suggestion_body")
      .setLabel("Details")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Describe your idea in detail...")
      .setMinLength(20)
      .setMaxLength(1000)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(bodyInput),
    );

    await ctx.showModal(modal);

    // Wait for submission (5 minute window)
    let submission;
    try {
      submission = await ctx.awaitModalSubmit({
        filter: (i) => i.customId === `suggestion_modal_${userId}` && i.user.id === userId,
        time: 5 * 60 * 1000,
      });
    } catch {
      // User dismissed or timed out — silently ignore
      return;
    }

    await submission.deferReply({ flags: MessageFlags.Ephemeral });

    const title = submission.fields.getTextInputValue("suggestion_title").trim();
    const body = submission.fields.getTextInputValue("suggestion_body").trim();
    const user = ctx.user;

    // Set cooldown now that the submission is confirmed
    await setCooldown(userId, "suggestion", COOLDOWN_SECS);

    // Build the suggestion embed to post
    const suggestionEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`💡 ${title}`)
      .setDescription(body)
      .addFields(
        { name: "Submitted by", value: `${user.tag} (${user.id})`, inline: true },
        { name: "Server", value: ctx.guild?.name ?? "Unknown", inline: true },
      )
      .setThumbnail(user.displayAvatarURL({ size: 64 }))
      .setTimestamp();

    // Deliver to suggestion channel or fallback to dev DM
    let delivered = false;
    if (env.SUGGESTION_CHANNEL_ID) {
      try {
        const channel = await client.channels.fetch(env.SUGGESTION_CHANNEL_ID);
        if (channel?.isTextBased()) {
          await channel.send({ embeds: [suggestionEmbed] });
          delivered = true;
        }
      } catch {}
    }

    if (!delivered) {
      try {
        const devUser = await client.users.fetch(config.ids.dev);
        await devUser.send({ embeds: [suggestionEmbed] });
        delivered = true;
      } catch {}
    }

    if (!delivered) {
      return submission.editReply({
        ...ui()
          .color(config.colors.error)
          .title(`${config.emojis.cross} Delivery Failed`)
          .body("Your suggestion could not be delivered right now. Please try again later.")
          .build(),
        flags: MessageFlags.IsComponentsV2,
      } as any);
    }

    return submission.editReply({
      ...ui()
        .color(config.colors.success)
        .title(`${config.emojis.tick} Suggestion Submitted`)
        .body(
          `Thanks for the feedback, **${user.username}**! Your suggestion has been sent to the development team.\n\n> **${title}**`,
        )
        .footer("You can submit another suggestion in 1 hour")
        .build(),
      flags: MessageFlags.IsComponentsV2,
    } as any);
  },
} as Command;
