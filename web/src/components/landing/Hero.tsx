"use client";

import { motion } from "motion/react";
import { env } from "~/env";

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.65, ease: [0.25, 0.1, 0.25, 1], delay },
  } as const;
}

interface HeroProps {
  fishCount: number;
}

export default function Hero({ fishCount }: HeroProps) {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-100" />
      <div className="pointer-events-none absolute left-1/3 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/8 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/3 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-accent-2/8 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.div {...fadeUp(0.05)}>
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-border-bright bg-surface px-4 py-1.5 text-sm text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Free to use &mdash; add to any server
          </span>
        </motion.div>

        <motion.h1
          {...fadeUp(0.15)}
          className="mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-7xl"
        >
          The fishing bot your{" "}
          <span className="gradient-text">Discord server</span> deserves
        </motion.h1>

        <motion.p
          {...fadeUp(0.25)}
          className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-muted"
        >
          Baitin brings deep fishing gameplay, a live player economy, pets,
          markets, and competitive events straight to your Discord server.
        </motion.p>

        <motion.div
          {...fadeUp(0.35)}
          className="flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <motion.a
            href={env.NEXT_PUBLIC_DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04, boxShadow: "0 0 40px rgba(79,142,247,0.28)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="rounded-xl bg-accent px-8 py-3.5 font-semibold text-white"
          >
            Add to Discord
          </motion.a>
          <motion.a
            href="/wiki"
            whileHover={{ scale: 1.02, borderColor: "var(--color-border-bright)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="rounded-xl border border-border bg-surface px-8 py-3.5 font-semibold text-text backdrop-blur-sm"
          >
            Browse the Wiki →
          </motion.a>
        </motion.div>

        <motion.div
          {...fadeUp(0.45)}
          className="mt-16 flex items-center justify-center gap-8 border-t border-border pt-10 sm:gap-16"
        >
          {[
            { value: fishCount > 0 ? `${fishCount}+` : "—", label: "Fish species" },
            { value: "42", label: "Slash commands" },
            { value: "Free", label: "Forever" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-text">{stat.value}</p>
              <p className="mt-0.5 text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
