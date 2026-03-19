const tips = [
  // Casting
  "Use `/cast` every 15 seconds for maximum coins and XP per session.",
  "A Mythic can appear on any cast — you don't need a special rod, just luck.",
  "Junk has a base 20% catch rate. Better rods and bait push it lower.",
  "Your rod's luck bonus boosts rare fish chances on every single cast.",
  "Casting consistently every day builds your streak. Day 7 pays out noticeably more.",
  "Bait is consumed on each cast. Check `/equip` to see what's active.",

  // Sack & Selling
  "Your sack fills up fast. Use `/sell all` to pocket coins and free up space.",
  "Upgrade your sack with `/sack upgrade` to hold more loot per session.",
  "Epic fish and above are worth holding — players on `/market` often pay above sell price.",
  "Use `/sack view` to sell individual items or check what you're carrying.",
  "The sell price is 60% of the item's value. `/market` listings can earn you more.",

  // Gear
  "Better rods reduce junk chance and boost rare catch rates — check `/shop`.",
  "Rods have durability. When they break, you revert to the Splintered Twig automatically.",
  "Equip bait from your sack with `/equip` to shift the odds toward rarer fish.",
  "The right bait for your level can double your rare catch rate.",

  // Economy
  "Claim `/daily`, `/weekly`, and `/monthly` for free coins — they stack.",
  "`/work`, `/beg`, `/search`, and `/crime` are fast coin boosts between casts.",
  "Your streak resets if you miss a full day. Claim `/daily` before bed.",
  "A 10-day streak gives a 50% bonus to XP and coins on every cast.",

  // Pets
  "Pets give passive buffs — XP boosts, coin boosts, luck, and cooldown reduction.",
  "Hatch eggs from `/shop` or the `/hut` to unlock pets. Higher tiers = better buffs.",
  "Stack pets with complementary buffs. A luck pet plus an XP pet is a strong combo.",
  "Check `/pets` to see your active pet buffs and which eggs are incubating.",

  // Hut
  "Your `/hut` fishes automatically while you're offline — upgrade it to increase capacity.",
  "The hut has its own catch rate. A higher-level hut lands rarer fish passively.",
  "Hut catches don't count toward your streak. Cast manually to keep the chain going.",

  // Collection & Profile
  "Use `/collection` to see every fish species you've ever caught — and what's still missing.",
  "`/collection rarity:legendary` jumps straight to your legendary and mythic catches.",
  "Your `/profile` shows level, gear, streak, and lifetime stats all in one place.",
  "Check `/achievements` to see what milestones you're close to unlocking.",
  "The `/almanac` lists every fish in the game with their rarity and sell value.",

  // Market & Leaderboard
  "List rare fish on `/market` — buyers pay premium for Epic and above.",
  "The `/leaderboard` ranks by total coins earned. Rare fish push you up fast.",
  "Auction listings on `/market` expire. Cancel and relist if it's not moving.",

  // Events
  "During events, XP and coin multipliers apply to every cast — don't miss them.",
  "Check `/event` to see if an active event is running and what bonuses it gives.",
  "Some fish only appear at boosted rates during specific events. Check `/almanac`.",
] as string[];

export const tip = () => {
  const index = Math.floor(Math.random() * tips.length);
  return tips[index];
};

export default tips;
