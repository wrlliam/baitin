import { env } from "@/env";

const INVITE_PERMISSIONS = 85056; // ViewChannel + SendMessages + EmbedLinks + AddReactions + ReadMessageHistory

export default {
  support: "https://discord.gg/aTkjGak2ZM",
  invite: `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&permissions=${INVITE_PERMISSIONS}&scope=bot+applications.commands`,
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
    // Core UI
    coin: "<:cash:1484157833187692604>",
    cross: "<:cross:1484157822915842220>",
    tick: "<:check:1484157831321227387>",
    gem: "<:diamond:1484157837805486162>",
    bot: "<:discord:1484157819585564833>",
    mod: "🔒",
    up_arrow: "⬆️",
    down_arrow: "⬇️",
    // Fishing & gameplay
    fish: "<:generic_fish:1484158342506090557>",
    rod: "🎣",
    bait: "🪱",
    pouch: "<:pouch:1484157839839723721>",
    hut: "🏚️",
    junk: "🗑️",
    egg: "🥚",
    // Economy & rewards
    crown: "<:crown:1484157854167601273>",
    trophy: "<:trophy:1484157816678908136>",
    medal: "🏅",
    loss: "<:wilted_flower:1484157843459407892>",
    // Luck & buffs
    clover: "<:clover:1484157841186095336>",
    boost: "<:boost_pixel_level_1:1484157825377767505>",
    rain_drop: "<:rain_drop:1484157836156993606>",
    // Games & fun
    slots: "🎰",
    dice: "🎲",
    crime: "🚔",
    heist: "🦹",
    shield: "🛡️",
    search: "🔍",
    work: "🪣",
    beg: "<:croissant:1484157821732782271>",
    flip: "<:cash:1484157833187692604>",
    // Pets
    pet: "<:pet_dog:1484157818092261486>",
    pet_hatch_fail: "<:wilted_flower:1484157843459407892>",
    // Events & misc
    event: "🎪",
    calendar: "📅",
    weekly: "📆",
    monthly: "🗓️",
    quest: "📜",
    achievement: "<:trophy:1484157816678908136>",
    // Buffs display
    xp_boost: "📖",
    coin_boost: "<:cash:1484157833187692604>",
    luck_boost: "<:clover:1484157841186095336>",
    cooldown_reduction: "⏱️",
    hatch_speed: "🥚",
    pet_effect_boost: "🐾",
    cost_reduction: "💸",
    // Help categories
    cat_general: "🌐",
    cat_rewards: "💰",
    cat_fishing: "🎣",
    cat_games: "🎰",
    cat_pvp: "⚔️",
    // Market filters
    market_all: "📦",
    market_bid: "🔨",
    market_buy: "💰",
    // Misc
    star: "⭐",
    fire: "🔥",
    sparkles: "✨",
    warning: "⚠️",
    lock: "🔒",
    blackjack: "♠",
    gear: "⚙️",
    handshake: "🤝",
    party: "🎉",
    duel: "⚔️",
    lottery: "🎟️",
    bounty: "🏴‍☠️",
    drop: "💰",
    gift: "🎁",
    rep: "💖",
    trade: "🔄",
    fishoff: "🏆",
    eight_ball: "🎱",
    math: "🧮",
    cards: "🃏",
    brain: "🧠",
    alert: "🚨",
    sell: "💰",
    higher_lower: "📈",
    roulette: "🎡",
    release: "<:generic_fish:1484158342506090557>",
    potion: "🧪",
    ceo: "<:ceo:1484157826854162574>",
    help: "📖",
    configure: "⚙️",
    collect: "🎣",
    inventory: "📦",
    refresh: "🔄",
    disguise: "🎭",
    nothing: "💸",
    cooldown: "⏳",
    correct: "<:check:1484157831321227387>",
    wrong: "<:cross:1484157822915842220>",
    timeout: "⏱️",
    lifesaver: "🛟",
    maple: "<:maple:1484157834471145552>",
    blossom: "<:blossom:1484157820650913842>",
    // Permissions
    owner: "👑",
    admin: "🛡️",
    member: "👤",
  },
  fishing: {
    sellPriceMultiplier: 0.5,
    maxAuctionListings: 5,
    castAnimationDelay: 250, // ms
    levelCoinBonusPercent: 0.015, // +1.5%/level
  },
} as const;
