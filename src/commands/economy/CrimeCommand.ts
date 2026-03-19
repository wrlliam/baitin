import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, subtractCoins } from "@/modules/fishing/economy";
import { checkCooldown, setCooldown } from "@/modules/fishing/economy_games";
import { ApplicationCommandType, MessageFlags } from "discord.js";

const COOLDOWN_SECS = 7200; // 2 hours
const FINE = 150;

const CRIMES = [
  "poaching rare fish in protected waters",
  "selling unlicensed bait on the black market",
  "running an illegal fish auction out of the docks",
  "fencing stolen fishing gear at the marina",
  "bribing the harbormaster to look the other way",
  "smuggling exotic sea creatures past customs",
  "rigging the fishing tournament for profit",
  "trespassing on a private fishing reserve",
];

export default {
  name: "crime",
  description: "Commit a crime and risk it for the big bucks.",
  type: ApplicationCommandType.ChatInput,
  usage: ["/crime"],
  defer: "none",
  options: [],
  run: async ({ ctx }) => {

    const cooldown = await checkCooldown(ctx.user.id, "crime");
    if (!cooldown.ok) {
      return ctx.reply({
        ...ui()
          .color(config.colors.default)
          .title(`${config.emojis.crime} Lay Low for Now`)
          .body(
            `The game warden is still watching you. Try again <t:${Math.floor(cooldown.expiresAt! / 1000)}:R>.`,
          )
          .build(),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      } as any);
    }

    await ctx.deferReply({});

    const crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
    await setCooldown(ctx.user.id, "crime", COOLDOWN_SECS);

    const success = Math.random() < 0.4;

    if (success) {
      const coins = 200 + Math.floor(Math.random() * 601);
      await addCoins(ctx.user.id, coins);
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.disguise} Got Away With It`)
          .body(
            `You were caught ${crime} — but slipped through the net!\n\nYou pocketed **${coins.toLocaleString()}** ${config.emojis.coin} and nobody was the wiser.`,
          )
          .footer("Cooldown: 2 hours • Baitin • /help")
          .build() as any,
      );
    } else {
      const paid = await subtractCoins(ctx.user.id, FINE);
      const fineText = paid
        ? `You were fined **${FINE}** ${config.emojis.coin}.`
        : `You couldn't pay the fine — the warden let you off with a warning.`;
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.crime} Busted!`)
          .body(
            `You were caught ${crime} and the game warden nabbed you.\n\n${fineText}`,
          )
          .footer("Cooldown: 2 hours • Baitin • /help")
          .build() as any,
      );
    }
  },
} as Command;
