import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { addCoins, subtractCoins } from "@/modules/fishing/economy";
import { ApplicationCommandType   MessageFlags,
} from "discord.js";

const COST = 50;
const SYMBOLS = ["🐟", "🦐", "🦞", "🐡", "💎"];

function spin(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export default {
  name: "slots",
  description: `Spin the slot machine for ${COST} coins a pull.`,
  type: ApplicationCommandType.ChatInput,
  usage: ["/slots"],
  options: [],
  run: async ({ ctx }) => {

    const paid = await subtractCoins(ctx.user.id, COST);
    if (!paid) {
      return ctx.editReply(
        ui()
          .color(config.colors.default)
          .title(`${config.emojis.cross} Not Enough Coins`)
          .body(
            `You need at least **${COST}** ${config.emojis.coin} to spin the slots.`,
          )
          .build() as any,
      );
    }

    const r1 = spin();
    const r2 = spin();
    const r3 = spin();

    // Animation frames
    await ctx.editReply({ content: `> ⬛ ⬛ ⬛\n*Spinning...*` });
    await sleep(500);
    await ctx.editReply({ content: `> ${r1} ⬛ ⬛\n*Spinning...*` });
    await sleep(500);
    await ctx.editReply({ content: `> ${r1} ${r2} ⬛\n*Spinning...*` });
    await sleep(500);

    let payout = 0;
    let resultText = "";

    if (r1 === r2 && r2 === r3 && r1 === "💎") {
      payout = 500;
      resultText = `💎 **JACKPOT!** Three diamonds! You won **${payout}** ${config.emojis.coin}!`;
    } else if (r1 === r2 && r2 === r3) {
      payout = 200;
      resultText = `🎉 **Three of a kind!** You won **${payout}** ${config.emojis.coin}!`;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      payout = COST;
      resultText = `🤏 **Two of a kind** — you got your bet back (**${payout}** ${config.emojis.coin}).`;
    } else {
      resultText = `😬 No match. You lost **${COST}** ${config.emojis.coin}.`;
    }

    if (payout > 0) await addCoins(ctx.user.id, payout);

    const color =
      payout > COST
        ? config.colors.success
        : payout === COST
          ? config.colors.warn
          : config.colors.error;

    const result = ui()
      .color(color)
      .title("🎰 Slot Machine")
      .body(`> ${r1} ${r2} ${r3}\n\n${resultText}`)
      .footer(`Cost: ${COST} coins per spin • Baitin • /help`)
      .build();
    await ctx.editReply({ content: "", ...result } as any);
  },
} as Command;
