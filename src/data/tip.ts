const tips = [
  // Economy
  "Always bank your coins after a big haul — your wallet isn't protected.",
  "The bank earns daily interest. The longer your coins sit, the more you earn.",
  "Missing a daily claim resets your streak. Even one missed day hurts.",
  "Your streak bonus stacks fast. A 7-day streak pays out significantly more than day one.",
  "Net worth includes your bank, wallet, and inventory — hoard wisely.",
  "Claim /daily before anything else. It's free coins every single session.",
  "Don't withdraw from your bank unless you need to spend it right now.",

  // Rods & Gear
  "Your starter rod can't catch the heaviest fish. Upgrade it as soon as you can.",
  "Heavier fish sell for more. A better rod raises your weight ceiling.",
  "Specialised bait pulls from higher rarity tiers. It's worth the coins.",
  "A boat upgrade increases your inventory size — stop losing catches to a full bag.",
  "The mid-tier rod with a luck upgrade often earns more per hour than the top rod alone.",
  "Don't sleep on bait. It's the cheapest way to improve your rare catch rate.",

  // Casting
  "Consistent daily casting beats marathon sessions — your cooldown caps your income.",
  "Fish weight is decided the moment you catch it, not when you sell. Check before bulk selling.",
  "A Mythic can appear on any cast. You don't need a special rod — just good timing and luck.",
  "Spamming /cast won't help. Your cooldown is exact, and early attempts simply won't fire.",
  "A heavy Common can outsell a light Uncommon. Always check the weight.",

  // Inventory
  "Sell small Common fish straight away to keep bag space open for better catches.",
  "Running out of inventory mid-session means lost catches. Sell often.",
  "Epic and above are worth holding if you're planning to trade — players pay above market.",
  "Check /collection for your personal bests. It tracks every catch you've ever landed.",
  "Your /inventory is your active bag. Your /collection is your permanent record.",

  // Trading & Leaderboard
  "Trades expire if the other player doesn't respond in time. Nothing is lost — just try again.",
  "The leaderboard ranks on net worth, not just wallet balance. Your fish count too.",
  "Holding onto high-rarity fish inflates your net worth without spending a coin.",
  "A direct trade often gets you more for a Legendary than selling it outright.",

  // General
  "Level up by catching fish, not just selling them. XP is awarded at the moment of the catch.",
  "Higher levels unlock shop items that aren't visible yet. Keep grinding.",
  "Check /shop before a session — stock and prices can change.",
  "Use /upgrade to see what bonuses are available. Some of them change your entire strategy.",
  "Your /collection is the best way to flex. Rarest catch wins.",
] as string[];

export const tip = () => {
  const index = Math.floor(Math.random() * tips.length);
  return tips[index];
};

export default tips;
