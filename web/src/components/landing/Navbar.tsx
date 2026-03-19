"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { env } from "~/env";
import ThemeToggle from "~/components/ThemeToggle";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Wiki", href: "/wiki" },
  { label: "Commands", href: "/commands" },
];

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-text">
          Baitin
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <motion.div key={label} whileHover={{ color: "var(--color-text)" }}>
              <Link href={href} className="text-sm text-muted transition-colors hover:text-text">
                {label}
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <motion.a
            href={env.NEXT_PUBLIC_DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04, boxShadow: "0 0 24px rgba(79,142,247,0.3)" }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Add to Discord
          </motion.a>
        </div>
      </div>
    </motion.nav>
  );
}
