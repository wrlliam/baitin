import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { env } from "@/env";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { submitReport } from "@/modules/moderation";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

const COOLDOWN_SECS = 1800; // 1 report per 30 minutes

export default {
  name: "report",
  description: "Report a player for abuse, cheating, or misconduct.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/report <user>"],
  defer: "none",
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "user",
      description: "The user you want to report",
      required: true,
    },
  ],
  run: async ({ client, args, ctx }) => {
    const target = args.getUser("user", true);
    const userId = ctx.user.id;

    if (target.id === userId) {
      return ctx.reply({
        ...ui()
          .color(config.colors.warn)
          .title(`${config.emojis.cross} Invalid Target`)
          .body("You can't report yourself.")
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    if (target.bot) {
      return ctx.reply({
        ...ui()
          .color(config.colors.warn)
          .title(`${config.emojis.cross} Invalid Target`)
          .body("You can't report a bot.")
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    const cooldown = await checkCooldown(userId, "report");
    if (!cooldown.ok) {
      return ctx.reply({
        ...ui()
          .color(config.colors.warn)
          .title(`${config.emojis.cooldown} Slow Down`)
          .body(
            `You already filed a report recently. You can submit again <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    const modal = new ModalBuilder()
      .setCustomId(`report_modal_${userId}`)
      .setTitle(`Report ${target.username}`);

    const reasonInput = new TextInputBuilder()
      .setCustomId("report_reason")
      .setLabel("Reason")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Describe what happened in detail...")
      .setMinLength(20)
      .setMaxLength(1000)
      .setRequired(true);

    const evidenceInput = new TextInputBuilder()
      .setCustomId("report_evidence")
      .setLabel("Evidence (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Screenshot URL or message link")
      .setMaxLength(500)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput),
    );

    await ctx.showModal(modal);

    let submission;
    try {
      submission = await ctx.awaitModalSubmit({
        filter: (i) => i.customId === `report_modal_${userId}` && i.user.id === userId,
        time: 5 * 60 * 1000,
      });
    } catch {
      return;
    }

    await submission.deferReply({ flags: MessageFlags.Ephemeral });

    const reason = submission.fields.getTextInputValue("report_reason").trim();
    const evidence = submission.fields.getTextInputValue("report_evidence").trim() || undefined;

    await submitReport(userId, target.id, reason, evidence);
    await setCooldown(userId, "report", COOLDOWN_SECS);

    // Deliver to report channel or fall back to dev DM
    const reportEmbed = new EmbedBuilder()
      .setColor(0xfb2c36)
      .setTitle(`🚨 Player Report`)
      .addFields(
        { name: "Target", value: `${target.tag} (\`${target.id}\`)`, inline: true },
        { name: "Reporter", value: `${ctx.user.tag} (\`${userId}\`)`, inline: true },
        { name: "Server", value: ctx.guild?.name ?? "Unknown", inline: true },
        { name: "Reason", value: reason },
      )
      .setTimestamp();

    if (evidence) reportEmbed.addFields({ name: "Evidence", value: evidence });

    let delivered = false;
    if (env.REPORT_CHANNEL_ID) {
      try {
        const channel = await client.channels.fetch(env.REPORT_CHANNEL_ID);
        if (channel?.isTextBased()) {
          await channel.send({ embeds: [reportEmbed] });
          delivered = true;
        }
      } catch {}
    }

    if (!delivered) {
      try {
        const devUser = await client.users.fetch(config.ids.dev);
        await devUser.send({ embeds: [reportEmbed] });
        delivered = true;
      } catch {}
    }

    return submission.editReply({
      ...ui()
        .color(config.colors.success)
        .title(`${config.emojis.tick} Report Submitted`)
        .body(
          `Your report against **${target.username}** has been sent to the moderation team.\n\nWe review all reports — thank you for helping keep the community safe.`,
        )
        .footer("You can submit another report in 30 minutes")
        .build(),
      flags: MessageFlags.IsComponentsV2,
    } as any);
  },
} as Command;
