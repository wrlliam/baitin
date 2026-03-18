export default {
  support: "https://discord.gg/aTkjGak2ZM",
  ids: {
    dev: "1283484433390895215",
  },
  embed: {
    defaultFooter: `Baitin • /help`,
  },
  status: {
    name: "Baitin • /help",
    state: "Baitin • /help",
  },
  timeout: {
    customCommands: 2.5 * 1000, // 2.5 seconds
    leveling: 6 * 1000, // 6 seconds
  },
  colors: {
    default: "#242429",
    error: "#fb2c36",
    success: "#00c951",
    info: "#242429",
    warn: "#ff8904",
  },
  emojis: {
    coin: `🪙`,
    up_arrow: `⬆️`,
    down_arrow: `⬇️`,
    cross: "❌",
    tick: "✅",
    bot: "🤖",
    mod: "🔒"
  },
  fishing: {
    sellPriceMultiplier: 0.6,
    maxAuctionListings: 5,
    castAnimationDelay: 250, // ms
    levelCoinBonusPercent: 0.015, // +1.5%/level
  },
} as const;
