"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type {
  BotBait,
  BotEgg,
  BotEvent,
  BotFish,
  BotPet,
  BotPotion,
  BotRod,
  ItemRarity,
} from "~/types/bot";

type WikiTab =
  | "fish"
  | "rods"
  | "baits"
  | "potions"
  | "pets"
  | "eggs"
  | "events";

interface WikiData {
  fish: BotFish[];
  rods: BotRod[];
  baits: BotBait[];
  potions: BotPotion[];
  pets: BotPet[];
  eggs: BotEgg[];
  events: BotEvent[];
}

const TABS: { key: WikiTab; label: string; emoji: string }[] = [
  { key: "fish", label: "Fish", emoji: "🐟" },
  { key: "rods", label: "Rods", emoji: "🎣" },
  { key: "baits", label: "Baits", emoji: "🪱" },
  { key: "potions", label: "Potions", emoji: "🧪" },
  { key: "pets", label: "Pets", emoji: "🐾" },
  { key: "eggs", label: "Eggs", emoji: "🥚" },
  { key: "events", label: "Events", emoji: "⚡" },
];

const RARITIES: ItemRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
];

const RARITY_BADGE: Record<ItemRarity, string> = {
  common: "text-slate-400  bg-slate-400/10  border-slate-400/20",
  uncommon: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  rare: "text-blue-400   bg-blue-400/10   border-blue-400/20",
  epic: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  legendary: "text-amber-400  bg-amber-400/10  border-amber-400/20",
  mythic: "text-rose-400   bg-rose-400/10   border-rose-400/20",
};

// ── Shared primitives ──────────────────────────────────────────────────────

function RarityBadge({ rarity }: { rarity: ItemRarity }) {
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium capitalize ${RARITY_BADGE[rarity]}`}
    >
      {rarity}
    </span>
  );
}

/** Fixed-height header shared by every card */
function CardHeader({
  emoji,
  name,
  rarity,
}: {
  emoji?: string;
  name: string;
  rarity?: ItemRarity;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5 overflow-hidden">
        {emoji && <span className="shrink-0 text-2xl">{emoji}</span>}
        <p className="text-text truncate font-semibold">{name}</p>
      </div>
      {rarity && <RarityBadge rarity={rarity} />}
    </div>
  );
}

/** Grows to fill available space so stat rows always sit at the bottom */
function CardDescription({ children }: { children: string }) {
  return (
    <p className="text-muted mb-3 line-clamp-3 flex-1 text-sm leading-relaxed">
      {children}
    </p>
  );
}

function StatRow({
  stats,
}: {
  stats: Array<{ label: string; value: string; negative?: boolean }>;
}) {
  return (
    <div className="border-border flex flex-wrap gap-x-4 gap-y-1 border-t pt-3">
      {stats.map(({ label, value, negative }) => (
        <div key={label} className="flex items-baseline gap-1 text-xs">
          <span className="text-muted">{label}</span>
          <span
            className={`font-mono font-semibold ${negative ? "text-red-400" : "text-text"}`}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function EffectRow({
  label,
  value,
  isDebuff,
}: {
  label: string;
  value: string;
  isDebuff: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-overlay px-2.5 py-1.5 text-xs">
      <span className="text-muted capitalize">{label}</span>
      <span
        className={`font-mono font-semibold ${isDebuff ? "text-red-400" : "text-accent"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Card components ────────────────────────────────────────────────────────

function FishCard({ item }: { item: BotFish }) {
  return (
    <div className="border-border bg-surface flex h-full flex-col rounded-xl border p-4">
      <CardHeader emoji={item.emoji} name={item.name} rarity={item.rarity} />
      <CardDescription>{item.description}</CardDescription>
      <StatRow
        stats={[
          { label: "Sell", value: `🪙 ${item.price}` },
          { label: "XP", value: `+${item.xp}` },
        ]}
      />
    </div>
  );
}

function RodCard({ item }: { item: BotRod }) {
  return (
    <div className="border-border bg-surface flex h-full flex-col rounded-xl border p-4">
      <CardHeader emoji={item.emoji} name={item.name} rarity={item.rarity} />
      <CardDescription>{item.description}</CardDescription>
      <StatRow
        stats={[
          {
            label: "Buy",
            value: item.buyPrice > 0 ? `🪙 ${item.buyPrice}` : "Free",
          },
          {
            label: "Luck",
            value:
              item.luckBonus > 0
                ? `+${(item.luckBonus * 100).toFixed(0)}%`
                : "—",
          },
          {
            label: "Speed",
            value: item.speedReduction > 0 ? `-${item.speedReduction}s` : "—",
          },
          {
            label: "Durability",
            value: item.durability > 0 ? String(item.durability) : "∞",
          },
        ]}
      />
    </div>
  );
}

function BaitCard({ item }: { item: BotBait }) {
  return (
    <div className="border-border bg-surface flex h-full flex-col rounded-xl border p-4">
      <CardHeader emoji={item.emoji} name={item.name} rarity={item.rarity} />
      <CardDescription>{item.description}</CardDescription>
      <StatRow
        stats={[
          { label: "Buy", value: `🪙 ${item.buyPrice}` },
          { label: "Rarity", value: `×${item.rarityMultiplier.toFixed(2)}` },
          {
            label: "Junk",
            value: `${item.junkModifier > 0 ? "+" : ""}${(item.junkModifier * 100).toFixed(0)}%`,
            negative: item.junkModifier > 0,
          },
          { label: "Uses", value: item.consumedOnUse ? "Single" : "Reusable" },
        ]}
      />
    </div>
  );
}

function PotionCard({ item }: { item: BotPotion }) {
  return (
    <div className="border-border bg-surface flex h-full flex-col rounded-xl border p-4">
      <CardHeader emoji={item.emoji} name={item.name} rarity={item.rarity} />
      <CardDescription>{item.description}</CardDescription>
      <div className="flex flex-col gap-1">
        {item.effects.map((e, i) => (
          <EffectRow
            key={i}
            label={e.type.replace(/_/g, " ")}
            value={`${e.amount > 0 ? "+" : ""}${(e.amount * 100).toFixed(0)}% · ${e.durationMinutes}m`}
            isDebuff={e.amount * 100 < 0}
          />
        ))}
      </div>
    </div>
  );
}

function PetCard({ item }: { item: BotPet }) {
  return (
    <div className="border-border bg-surface flex h-full flex-col rounded-xl border p-4">
      <CardHeader emoji={item.emoji} name={item.name} rarity={item.rarity} />
      <CardDescription>{item.description}</CardDescription>
      <div className="flex flex-col gap-1">
        {item.buffs.map((b, i) => (
          <EffectRow
            key={i}
            label={b.type.replace(/_/g, " ")}
            value={`+${(b.value * 100).toFixed(0)}%`}
            isDebuff={false}
          />
        ))}
      </div>
    </div>
  );
}

function EggCard({ item }: { item: BotEgg }) {
  return (
    <div className="border-border bg-surface flex h-full flex-col rounded-xl border p-4">
      <CardHeader emoji={item.emoji} name={item.name} rarity={item.rarity} />
      <CardDescription>{item.description}</CardDescription>
      <StatRow
        stats={[
          { label: "Hatch", value: `${item.hatchTimeMinutes}m` },
          {
            label: "Fail",
            value: `${(item.failChance * 100).toFixed(0)}%`,
            negative: item.failChance > 0,
          },
          { label: "Pets", value: String(item.possiblePets.length) },
        ]}
      />
    </div>
  );
}

function EventCard({ item }: { item: BotEvent }) {
  const durationMins = Math.round(item.duration / 60000);
  return (
    <div className="border-border bg-surface flex h-full flex-col rounded-xl border p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-text font-semibold">{item.name}</p>
        {item.entryFee && (
          <span className="shrink-0 rounded border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-xs text-amber-400">
            🪙 {item.entryFee}
          </span>
        )}
      </div>
      <CardDescription>{item.description}</CardDescription>
      <div className="flex flex-col gap-1">
        {item.effects.map((e, i) => (
          <EffectRow
            key={i}
            label={e.type.replace(/_/g, " ")}
            value={`×${e.value.toFixed(1)}`}
            isDebuff={e.value < 1}
          />
        ))}
        <div className="border-border text-muted mt-1 border-t pt-2 text-xs">
          Duration{" "}
          <span className="text-text font-semibold">{durationMins}m</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WikiClient({
  fish,
  rods,
  baits,
  potions,
  pets,
  eggs,
  events,
}: WikiData) {
  const [tab, setTab] = useState<WikiTab>("fish");
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState<ItemRarity | "">("");

  const tabData = useMemo(
    () => ({ fish, rods, baits, potions, pets, eggs, events }),
    [fish, rods, baits, potions, pets, eggs, events],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let items = tabData[tab] as (
      | BotFish
      | BotRod
      | BotBait
      | BotPotion
      | BotPet
      | BotEgg
      | BotEvent
    )[];
    if (q) {
      items = items.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q),
      );
    }
    if (rarity && tab !== "events") {
      items = items.filter(
        (it) => (it as { rarity?: string }).rarity === rarity,
      );
    }
    return items;
  }, [tab, search, rarity, tabData]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(tabData) as WikiTab[]).map((k) => [k, tabData[k].length]),
      ),
    [tabData],
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <p className="text-accent mb-3 text-sm font-semibold tracking-widest uppercase">
          Wiki
        </p>
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight">
          Game Database
        </h1>
        <p className="text-muted mx-auto max-w-md">
          Browse every fish, rod, bait, potion, pet, egg, and event in Baitin.
        </p>
      </motion.div>

      {/* Search + rarity filter */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-border bg-surface text-text placeholder:text-muted focus:border-accent/40 min-w-0 flex-1 rounded-lg border px-4 py-2.5 text-sm focus:outline-none"
        />
        {tab !== "events" && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setRarity("")}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${rarity === "" ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted hover:text-text"}`}
            >
              All
            </button>
            {RARITIES.map((r) => (
              <button
                key={r}
                onClick={() => setRarity(r === rarity ? "" : r)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${rarity === r ? RARITY_BADGE[r] : "border-border text-muted hover:text-text"}`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Tab bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="border-border bg-surface mb-8 flex overflow-x-auto rounded-xl border p-1"
      >
        {TABS.map(({ key, label, emoji }) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setRarity("");
              }}
              className="relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                color: isActive ? "var(--color-text)" : "var(--color-muted)",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="wiki-tab-active"
                  className="bg-surface-2 absolute inset-0 rounded-lg"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative z-10">{emoji}</span>
              <span className="relative z-10">{label}</span>
              <span className="text-muted-2 relative z-10 rounded-full bg-overlay px-1.5 py-0.5 text-xs">
                {counts[key]}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {filtered.length === 0 ? (
            <p className="text-muted py-20 text-center">
              Nothing matches your search.
            </p>
          ) : (
            <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item, i) => (
                <motion.div
                  key={item.name}
                  className="h-full"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.18,
                    delay: Math.min(i * 0.02, 0.3),
                  }}
                >
                  {tab === "fish" && <FishCard item={item as BotFish} />}
                  {tab === "rods" && <RodCard item={item as BotRod} />}
                  {tab === "baits" && <BaitCard item={item as BotBait} />}
                  {tab === "potions" && <PotionCard item={item as BotPotion} />}
                  {tab === "pets" && <PetCard item={item as BotPet} />}
                  {tab === "eggs" && <EggCard item={item as BotEgg} />}
                  {tab === "events" && <EventCard item={item as BotEvent} />}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
