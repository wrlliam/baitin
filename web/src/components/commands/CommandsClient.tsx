"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { BotCommand } from "~/types/bot";

interface Props {
  commands: BotCommand[];
}

type CategoryKey = "fishing" | "economy" | "general" | "misc";

const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: "fishing", label: "Fishing", emoji: "🎣" },
  { key: "economy", label: "Economy", emoji: "💰" },
  { key: "general", label: "General", emoji: "🌐" },
  { key: "misc", label: "Misc", emoji: "✨" },
];

export default function CommandsClient({ commands }: Props) {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("fishing");
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    return commands.filter(
      (c) =>
        c.category === activeCategory &&
        (c.name.includes(q) || c.description.toLowerCase().includes(q)),
    );
  }, [commands, activeCategory, search]);

  const totalByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of commands) {
      counts[c.category] = (counts[c.category] ?? 0) + 1;
    }
    return counts;
  }, [commands]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">
          Reference
        </p>
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight">
          Slash Commands
        </h1>
        <p className="mx-auto max-w-md text-lg text-muted">
          Every command available in Baitin, organized by category.
        </p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-6"
      >
        <input
          type="text"
          placeholder="Search commands…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-muted focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
      </motion.div>

      {/* Category tabs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mb-8 flex gap-2 overflow-x-auto rounded-xl border border-border bg-surface p-1"
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          const count = totalByCategory[cat.key] ?? 0;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ color: isActive ? "var(--color-text)" : "var(--color-muted)" }}
            >
              {isActive && (
                <motion.div
                  layoutId="cmd-tab-active"
                  className="absolute inset-0 rounded-lg bg-surface-2"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative z-10">{cat.emoji}</span>
              <span className="relative z-10">{cat.label}</span>
              <span className="relative z-10 rounded-full bg-overlay px-1.5 py-0.5 text-xs text-muted">
                {count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Commands grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {grouped.length === 0 ? (
            <p className="py-16 text-center text-muted">No commands found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {grouped.map((cmd, i) => (
                <motion.div
                  key={cmd.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.035 }}
                  whileHover={{ borderColor: "var(--color-border-bright)" }}
                  className="rounded-xl border border-border bg-surface p-5 transition-colors"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="font-mono text-base font-semibold text-accent">
                      /{cmd.name}
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      {cmd.adminOnly && (
                        <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-xs text-amber-400">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-muted">
                    {cmd.description}
                  </p>
                  {cmd.usage.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {cmd.usage.map((u) => (
                        <code
                          key={u}
                          className="rounded-md bg-overlay px-2 py-0.5 font-mono text-xs text-muted-2"
                        >
                          {u}
                        </code>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
