import config from "@/config";
import { ui } from "@/ui";
import { Command } from "@/core/typings";
import { getCurrentWeather, getWeatherForecast } from "@/modules/fishing/weather";
import { ApplicationCommandType } from "discord.js";

export default {
  name: "weather",
  description: "Check the current weather and upcoming forecast",
  type: ApplicationCommandType.ChatInput,
  usage: ["/weather"],
  defer: true,
  options: [],
  run: async ({ ctx }) => {
    const current = getCurrentWeather();
    const forecast = getWeatherForecast(4);

    const effectLabels: Record<string, string> = {
      catch_rate: "Catch Rate",
      rarity_boost: "Rarity",
      coin_multiplier: "Coins",
      xp_multiplier: "XP",
    };

    const currentEffects = current.effects
      .map((e) => `${effectLabels[e.type] ?? e.type}: ×${e.value}`)
      .join(" • ");

    const forecastLines = forecast
      .map((f, i) => {
        const label = i === 0 ? "**Now**" : `<t:${f.startsAt}:R>`;
        return `${f.weather.emoji} **${f.weather.name}** — ${label}`;
      })
      .join("\n");

    const embed = ui()
      .color(config.colors.default)
      .title(`${current.emoji} Current Weather: ${current.name}`)
      .text(`*${current.description}*\n\n${currentEffects}`)
      .divider()
      .text(`**Forecast:**\n${forecastLines}`)
      .footer("Weather changes every 6 hours")
      .build();

    await ctx.editReply(embed as any);
  },
} as Command;
