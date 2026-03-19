import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getOrCreateProfile } from "@/modules/fishing/economy";
import {
  canJoinHeist,
  isHeistImmune,
  executeHeist,
  calculateHeistSuccess,
} from "@/modules/fishing/heist";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";

const RECRUIT_TIME = 60_000; // 60 seconds
const MAX_PARTICIPANTS = 5;
const MIN_TARGET_COINS = 1000;

export default {
  name: "heist",
  description: "Assemble a crew and rob another player!",
  type: ApplicationCommandType.ChatInput,
  usage: ["/heist <target>"],
  defer: "none",
  options: [
    {
      name: "target",
      description: "Who to rob.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
  ],
  run: async ({ args, ctx }) => {
    const target = args.getUser("target", true);

    if (target.id === ctx.user.id) {
      return ctx.reply({ content: `${config.emojis.cross} You can't heist yourself!`, flags: MessageFlags.Ephemeral });
    }
    if (target.bot) {
      return ctx.reply({ content: `${config.emojis.cross} You can't heist a bot!`, flags: MessageFlags.Ephemeral });
    }

    // Check initiator cooldown
    const cd = await canJoinHeist(ctx.user.id);
    if (!cd.ok) {
      return ctx.reply({
        ...ui()
          .color(config.colors.default)
          .title("⏳ Cooldown")
          .body(`You can join a heist again <t:${Math.floor(cd.expiresAt! / 1000)}:R>.`)
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    // Check target immunity
    const immunity = await isHeistImmune(target.id);
    if (immunity.immune) {
      return ctx.reply({
        ...ui()
          .color(config.colors.default)
          .title(`${config.emojis.shield} Target Protected`)
          .body(`**${target.username}** is immune from heists until <t:${Math.floor(immunity.expiresAt! / 1000)}:R>.`)
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    // Check target has enough coins
    const targetProfile = await getOrCreateProfile(target.id);
    if (targetProfile.coins < MIN_TARGET_COINS) {
      return ctx.reply({
        content: `${config.emojis.cross} **${target.username}** doesn't have enough coins (need ${MIN_TARGET_COINS.toLocaleString()}+).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Level diff check
    const initiatorProfile = await getOrCreateProfile(ctx.user.id);
    if (targetProfile.level < initiatorProfile.level - 5) {
      return ctx.reply({
        content: `${config.emojis.cross} **${target.username}** is too far below your level.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Recruitment phase
    const participants = new Set<string>([ctx.user.id]);

    const joinRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("heist:join")
        .setLabel(`Join Heist (1/${MAX_PARTICIPANTS})`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(config.emojis.heist),
    );

    const successPct = Math.round(calculateHeistSuccess(1) * 100);

    const { resource } = await ctx.reply({
      ...ui()
        .color(config.colors.default)
        .title(`${config.emojis.heist} Heist Recruitment!`)
        .body(
          `**${ctx.user.username}** is planning a heist on **${target.username}**!\n\n` +
          `Join the crew within 60 seconds. Min 2 people needed.\n` +
          `Current success chance: **${successPct}%**\n\n` +
          `Crew: <@${ctx.user.id}>`,
        )
        .build({ rows: [joinRow] }),
      withResponse: true,
    } as any);

    const reply = resource!.message!;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: RECRUIT_TIME,
      filter: (i: any) => i.customId === "heist:join",
    });

    collector.on("collect", async (i: any) => {
      if (i.user.id === target.id) {
        return i.reply({ content: `${config.emojis.cross} You're the target!`, flags: MessageFlags.Ephemeral });
      }
      if (participants.has(i.user.id)) {
        return i.reply({ content: `${config.emojis.cross} You already joined!`, flags: MessageFlags.Ephemeral });
      }

      // Check joiner's cooldown
      const joinerCd = await canJoinHeist(i.user.id);
      if (!joinerCd.ok) {
        return i.reply({
          content: `${config.emojis.cross} You're on heist cooldown until <t:${Math.floor(joinerCd.expiresAt! / 1000)}:R>.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      participants.add(i.user.id);
      const pctNow = Math.round(calculateHeistSuccess(participants.size) * 100);

      const updatedJoinRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("heist:join")
          .setLabel(`Join Heist (${participants.size}/${MAX_PARTICIPANTS})`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji(config.emojis.heist)
          .setDisabled(participants.size >= MAX_PARTICIPANTS),
      );

      const crewMentions = [...participants].map((id) => `<@${id}>`).join(", ");

      await i.update(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.heist} Heist Recruitment!`)
          .body(
            `**${ctx.user.username}** is planning a heist on **${target.username}**!\n\n` +
            `Success chance: **${pctNow}%**\n\n` +
            `Crew: ${crewMentions}`,
          )
          .build({ rows: [updatedJoinRow] }) as any,
      );

      if (participants.size >= MAX_PARTICIPANTS) {
        collector.stop("full");
      }
    });

    collector.on("end", async () => {
      if (participants.size < 2) {
        return reply.edit(
          ui()
            .color(config.colors.error)
            .title(`${config.emojis.heist} Heist Cancelled`)
            .body("Not enough people joined. You need at least 2 crew members.")
            .build() as any,
        ).catch(() => {});
      }

      // Execute heist
      const result = await executeHeist([...participants], target.id);
      const crewMentions = [...participants].map((id) => `<@${id}>`).join(", ");

      if (result.success) {
        await reply.edit(
          ui()
            .color(config.colors.success)
            .title(`${config.emojis.heist} Heist Successful!`)
            .body(
              `The crew robbed **${target.username}** for **${result.stolen!.toLocaleString()}** ${config.emojis.coin}!\n\n` +
              `Each member gets **${result.share!.toLocaleString()}** ${config.emojis.coin}.\n` +
              `Crew: ${crewMentions}`,
            )
            .build() as any,
        ).catch(() => {});
      } else {
        await reply.edit(
          ui()
            .color(config.colors.error)
            .title(`${config.emojis.heist} Heist Failed!`)
            .body(
              `The crew got caught trying to rob **${target.username}**!\n\n` +
              `Each member was fined **${result.fine!.toLocaleString()}** ${config.emojis.coin}.\n` +
              `Crew: ${crewMentions}`,
            )
            .build() as any,
        ).catch(() => {});
      }

      // Notify target
      try {
        const targetUser = await (ctx as any).client?.users?.fetch(target.id);
        if (targetUser) {
          await targetUser.send({
            content: result.success
              ? `${config.emojis.alert} A crew led by **${ctx.user.username}** heisted **${result.stolen!.toLocaleString()}** ${config.emojis.coin} from you!`
              : `${config.emojis.shield} A crew led by **${ctx.user.username}** tried to heist you but got caught!`,
          }).catch(() => {});
        }
      } catch {}
    });
  },
} as Command;
