const tips = [
  // ── Casting & Cooldown ────────────────────────────────────────────────────
  "Use `/cast` every 20 seconds for the best XP and coin rate per session.",
  "A Mythic can appear on any cast — you don't need a special rod, just luck.",
  "Junk has a base 20% catch rate. Better rods and bait reduce it significantly.",
  "Your rod's luck bonus boosts rare fish chances on every single cast.",
  "Higher levels take a lot more XP to reach — consistent daily sessions beat binge fishing.",
  "Bait is consumed on each cast. Check `/equip` to see what's currently active.",
  "Potions stack with bait and rod luck bonuses — combine them during events for huge multipliers.",
  "Every 10th cast with the Chum Streamer upgrade automatically procs a luck buff for free.",

  // ── Streak ────────────────────────────────────────────────────────────────
  "Casting consistently every day builds your streak. Day 10 gives a 50% bonus to XP and coins.",
  "Your streak resets if you miss a full day. Log in and `/cast` once before midnight to keep it alive.",
  "A 10-day streak is the maximum bonus — +50% XP and coins per catch. It's worth maintaining.",
  "Missing one day doesn't just break your streak, it resets your multiplier back to zero.",

  // ── Sack & Selling ────────────────────────────────────────────────────────
  "Your sack fills up fast. Use `/sell all` to pocket coins and free up space.",
  "Upgrade your sack with `/sack upgrade` to hold more loot per session. Later tiers cost significantly more.",
  "Epic fish and above are worth holding — players on `/market` often pay above the base sell price.",
  "The sell price is 50% of an item's value. Listing on `/market` can earn you considerably more.",
  "Use `/sack view` to inspect your haul and sell items individually.",
  "The Master's Tackle Box upgrade adds 10 extra inventory slots per tier — handy for marathon sessions.",

  // ── Gear & Shop ───────────────────────────────────────────────────────────
  "Better rods reduce junk chance and boost rare catch rates — check `/shop rods`.",
  "Rods have durability. When they break you revert to the Splintered Twig automatically.",
  "Equip bait with `/equip` to shift the catch odds toward rarer fish.",
  "High-end rods also reduce cooldown time, letting you cast more times per hour.",
  "The Mythic rods have cooldown reductions of 10–12 seconds — a huge advantage over time.",
  "Rod sell-back value is about 30% of the buy price. Sell old rods in `/shop` when upgrading.",

  // ── Upgrades ─────────────────────────────────────────────────────────────
  "The Multi-Cast Engine lets you cast multiple lines per command — Tier 5 casts six at once.",
  "Multi-Cast is the most expensive upgrade but the biggest XP multiplier in the game. Save up.",
  "Auto-Sell Junk sells low-value catches automatically on cast. Great for unattended grinding.",
  "The Tax Haven License cuts sell and market fees by 25% — worth it once you're moving high-value fish.",
  "High-Tension Line gives +10% luck for legendary+ fish. A must-have for endgame fishing.",
  "The Bait Compressor gives a 15% chance to not consume bait on each cast. It pays for itself.",
  "Deep-Sea Sonar lets you whitelist rarities from auto-sell, so your epics never get sold accidentally.",
  "Upgrades are permanent purchases — they carry through every session and never expire.",
  "Check `/upgrades` to see every available upgrade, what it costs, and what tier you're at.",

  // ── Economy & Rewards ─────────────────────────────────────────────────────
  "Claim `/daily`, `/weekly`, and `/monthly` for free coins and items — they all stack.",
  "`/work`, `/beg`, `/search`, and `/crime` are quick coin boosts between casts.",
  "The level coin bonus is +1% per level above 1 — higher levels passively earn more per catch.",
  "Selling a full sack of rare fish at once can earn more coins than an hour of `/work` grinding.",

  // ── Social & PvP ──────────────────────────────────────────────────────────
  "Use `/give` to send coins to friends or to help newer players get started.",
  "Challenge someone to a `/duel` — winner takes a chunk of the pot.",
  "`/heist` requires multiple players and has a high payout but a real chance of failure.",
  "Place a `/bounty` on a player to incentivise others to steal from them.",
  "`/steal` has a cooldown and a risk of failure — higher-level targets fight back harder.",
  "Use `/trade` to swap items directly with another player without the market fee.",
  "`/rep` gives another player a reputation point once per day. High rep is a flex.",
  "`/lottery` tickets are cheap — buying a few regularly is worth it for the jackpot chance.",

  // ── Quests ────────────────────────────────────────────────────────────────
  "Check `/quests` for daily and weekly objectives — completing them gives bonus coins and XP.",
  "Quest goals refresh on a timer. Complete them before they expire to collect the reward.",
  "Some quests require specific catch types or rarities — equip matching bait to hit them faster.",

  // ── Pets ──────────────────────────────────────────────────────────────────
  "Pets give passive buffs — XP boosts, coin boosts, luck, and cooldown reduction.",
  "Hatch eggs from `/shop` or the market to unlock pets. Higher-tier eggs give better buffs.",
  "Stack pets with complementary buffs. A luck pet plus a coin pet is a powerful combo.",
  "Check `/pets` to view your roster, equip a pet, or see which eggs are still incubating.",
  "Pet upgrades improve their stats. Rename a pet with `/pets rename` to personalise it.",

  // ── Hut ───────────────────────────────────────────────────────────────────
  "Your `/hut` fishes automatically while you're offline — upgrade it to increase capacity and speed.",
  "Hut catches don't count toward your streak. Make sure to `/cast` manually every day.",
  "A higher-level hut has better luck and catches rarer fish passively overnight.",
  "Collect your hut loot with `/hut collect` — a full hut stops accumulating until you do.",

  // ── Events ────────────────────────────────────────────────────────────────
  "During events, XP and coin multipliers apply to every cast — don't skip them.",
  "Check `/event` to see if an active event is running and what bonuses it grants.",
  "Some events have an entry fee. Pay it early and fish the whole duration to maximise value.",
  "Event bonuses stack with your streak multiplier and active potions.",

  // ── Market ────────────────────────────────────────────────────────────────
  "List rare fish on `/market` — buyers pay a premium for Epic and above.",
  "Auction listings let buyers bid against each other, often pushing the price higher.",
  "Expired auction listings return your items. Relist at a better time if demand is low.",
  "Market fees are reduced by 25% if you own the Tax Haven License upgrade.",

  // ── Leaderboard & Profile ─────────────────────────────────────────────────
  "Check `/leaderboard` to see top players by coins, level, or total catches.",
  "Use `/settings leaderboard hide` if you'd rather not appear on the public leaderboard.",
  "Your `/profile` shows level, gear, streak, reputation, and lifetime stats all in one place.",
  "Check `/achievements` to see what milestones are close — some unlock hidden rewards.",
  "The `/almanac` lists every fish in the game with their rarity, XP, and base sell value.",

  // ── Misc ──────────────────────────────────────────────────────────────────
  "Use `/wiki` to look up any item, fish, rod, bait, or pet in the game.",
  "Got an idea to improve the bot? Use `/suggestion` to send it straight to the dev team.",
  "New to the game? Run `/getting-started` for a step-by-step beginner guide.",
  "`/buffs` shows all your currently active potion effects and how long they last.",
] as string[];

export const tip = () => {
  const index = Math.floor(Math.random() * tips.length);
  return tips[index];
};

export default tips;
