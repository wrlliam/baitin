"use client";

import { motion } from "motion/react";

/*
  Desktop 4-col bento (lg:auto-rows-[180px]):

  Row 1: [Fishing 2×2] [Economy 1×1] [Huts 1×1]
  Row 2: [Fishing 2×2] [Pet System 2×1]
  Row 3: [Market 1×1] [Potions 1×1] [Achievements 2×1]
  Row 4: [Live Events 4×1]
*/
const FEATURES = [
  {
    id: "fishing",
    emoji: "🎣",
    title: "Fishing",
    description:
      "Cast your line and reel in hundreds of unique fish across different biomes and rarities. Upgrade your rod, equip bait, and level up your skills to land the rarest catches.",
    variant: "hero" as const,
    // lg: col-span-2 row-span-2 | sm: col-span-2
    cls: "sm:col-span-2 lg:col-span-2 lg:row-span-2",
  },
  {
    id: "economy",
    emoji: "💰",
    title: "Economy",
    description: "Earn coins through fishing and build wealth across a fully-fledged server economy.",
    variant: "small" as const,
    cls: "",
  },
  {
    id: "huts",
    emoji: "🏚️",
    title: "Fishing Huts",
    description: "Upgrade your hut for passive income and exclusive perks.",
    variant: "small" as const,
    cls: "",
  },
  {
    id: "pets",
    emoji: "🐾",
    title: "Pet System",
    description:
      "Raise companions that grant passive bonuses to every catch. Hatch eggs, level them up, and build the perfect fishing crew.",
    variant: "wide" as const,
    // lg: col-span-2 | sm: col-span-2
    cls: "sm:col-span-2 lg:col-span-2",
  },
  {
    id: "market",
    emoji: "🛒",
    title: "Player Market",
    description: "Buy and sell fish and items with other players in real time.",
    variant: "small" as const,
    cls: "",
  },
  {
    id: "potions",
    emoji: "🧪",
    title: "Potion Buffs",
    description: "Brew potions for temporary luck, XP, and coin multipliers.",
    variant: "small" as const,
    cls: "",
  },
  {
    id: "achievements",
    emoji: "🏆",
    title: "Achievements",
    description:
      "Unlock dozens of achievements that reward your fishing milestones and dedication.",
    variant: "wide" as const,
    cls: "sm:col-span-2 lg:col-span-2",
  },
  {
    id: "events",
    emoji: "⚡",
    title: "Live Events",
    description:
      "Server-wide fishing tournaments and timed events drop exclusive rewards — with doubled XP, coin multipliers, and rare-fish boosts active for all players.",
    variant: "banner" as const,
    cls: "sm:col-span-2 lg:col-span-4",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-12 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
            Features
          </p>
          <h2 className="text-4xl font-bold tracking-tight">
            Everything you need to fish
          </h2>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-flow-dense grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[180px]">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.05 }}
              className={`rounded-2xl border border-border bg-surface ${feature.cls}`}
            >
              {/* Hero — tall 2×2 */}
              {feature.variant === "hero" && (
                <div className="flex h-full flex-col justify-between p-7">
                  <span className="text-5xl">{feature.emoji}</span>
                  <div>
                    <h3 className="mb-2 text-xl font-bold tracking-tight text-text">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
                  </div>
                </div>
              )}

              {/* Small — compact square */}
              {feature.variant === "small" && (
                <div className="flex h-full flex-col justify-between p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-dim text-lg">
                    {feature.emoji}
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-text">{feature.title}</h3>
                    <p className="text-xs leading-relaxed text-muted">{feature.description}</p>
                  </div>
                </div>
              )}

              {/* Wide — 2×1 horizontal */}
              {feature.variant === "wide" && (
                <div className="flex h-full items-center gap-5 p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-2xl">
                    {feature.emoji}
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-1.5 font-semibold text-text">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
                  </div>
                </div>
              )}

              {/* Banner — full-width strip */}
              {feature.variant === "banner" && (
                <div className="flex h-full items-center gap-6 p-6 lg:gap-10 lg:p-8">
                  <span className="shrink-0 text-4xl lg:text-5xl">{feature.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1.5 text-base font-bold text-text lg:text-lg">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted">{feature.description}</p>
                  </div>
                  <div className="hidden shrink-0 gap-2 lg:flex">
                    {["2× XP", "Coin Boost", "Rare Fish"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-accent/30 bg-accent-dim px-3 py-1 text-xs font-medium text-accent"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
