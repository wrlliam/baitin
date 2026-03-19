"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

type TabKey = "fishing" | "economy" | "market" | "pets";

interface Command {
  name: string;
  description: string;
}

interface TabData {
  label: string;
  emoji: string;
  commands: Command[];
}

const COMMANDS: Record<TabKey, TabData> = {
  fishing: {
    label: "Fishing",
    emoji: "🎣",
    commands: [
      { name: "/fish", description: "Cast your line and attempt to catch a fish." },
      { name: "/inventory", description: "View your current fish and item inventory." },
      { name: "/sell all", description: "Sell all fish in your inventory for coins." },
      { name: "/profile", description: "View your fishing stats, level, and achievements." },
      { name: "/leaderboard", description: "See the top fishers on the server by coins or catches." },
      { name: "/bait", description: "Browse and equip available bait to improve catches." },
      { name: "/rod", description: "View and upgrade your fishing rod." },
      { name: "/biome", description: "Travel to a different fishing biome for new catches." },
    ],
  },
  economy: {
    label: "Economy",
    emoji: "💰",
    commands: [
      { name: "/balance", description: "Check your current coin balance." },
      { name: "/daily", description: "Claim your daily coin reward." },
      { name: "/pay", description: "Transfer coins to another server member." },
      { name: "/shop", description: "Browse the server shop for items and upgrades." },
      { name: "/buy", description: "Purchase an item from the shop." },
      { name: "/potion brew", description: "Brew a potion using collected ingredients." },
      { name: "/potion use", description: "Consume a potion to activate its temporary buff." },
      { name: "/stats economy", description: "View your total earnings, spending, and coin history." },
    ],
  },
  market: {
    label: "Market",
    emoji: "🛒",
    commands: [
      { name: "/market list", description: "List an item or fish for sale on the player market." },
      { name: "/market browse", description: "Browse all active player market listings." },
      { name: "/market buy", description: "Purchase a listing from the player market." },
      { name: "/market cancel", description: "Cancel one of your active market listings." },
      { name: "/market history", description: "View your past market sales and purchases." },
      { name: "/market search", description: "Search the market for a specific item or fish." },
    ],
  },
  pets: {
    label: "Pets & Hut",
    emoji: "🐾",
    commands: [
      { name: "/pet list", description: "View all pets you've collected." },
      { name: "/pet equip", description: "Equip an active pet to gain its passive bonuses." },
      { name: "/pet feed", description: "Feed your pet to maintain its happiness and bonuses." },
      { name: "/hut view", description: "View your fishing hut and its current level." },
      { name: "/hut upgrade", description: "Spend coins to upgrade your hut tier." },
      { name: "/hut collect", description: "Collect passive coins earned by your hut." },
      { name: "/hut workers", description: "Manage workers assigned to your fishing hut." },
    ],
  },
};

const TAB_KEYS: TabKey[] = ["fishing", "economy", "market", "pets"];

export default function CommandsTabs() {
  const [active, setActive] = useState<TabKey>("fishing");
  const tab = COMMANDS[active];

  return (
    <section id="commands" className="py-32">
      <div className="mx-auto max-w-4xl px-6">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-16 text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
            Commands
          </p>
          <h2 className="text-4xl font-bold tracking-tight">
            Everything at a slash
          </h2>
        </motion.div>

        {/* Tab bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex overflow-x-auto rounded-xl border border-border bg-surface p-1"
        >
          {TAB_KEYS.map((key) => {
            const t = COMMANDS[key];
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                className="relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
                style={{ color: isActive ? "var(--color-text)" : "var(--color-muted)" }}
              >
                {isActive && (
                  <motion.div
                    layoutId="tab-active"
                    className="absolute inset-0 rounded-lg bg-surface-2"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative z-10">{t.emoji}</span>
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Command grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="grid grid-cols-1 gap-2.5 md:grid-cols-2"
          >
            {tab.commands.map((cmd, i) => (
              <motion.div
                key={cmd.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                whileHover={{ borderColor: "var(--color-border-bright)" }}
                className="rounded-xl border border-border bg-surface p-4 transition-colors"
              >
                <p className="mb-1 font-mono text-sm font-semibold text-accent">
                  {cmd.name}
                </p>
                <p className="text-sm leading-relaxed text-muted">
                  {cmd.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
