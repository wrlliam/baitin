import { type Metadata } from "next";
import Footer from "~/components/landing/Footer";
import Navbar from "~/components/landing/Navbar";
import WikiClient from "~/components/wiki/WikiClient";
import {
  getBaits,
  getEggs,
  getEvents,
  getFish,
  getPets,
  getPotions,
  getRods,
} from "~/lib/api";

export const metadata: Metadata = {
  title: "Wiki — Baitin 🎣",
  description:
    "Browse every fish, rod, bait, potion, pet, egg, and event in the Baitin fishing bot.",
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function WikiPage() {
  const [fishData, rodsData, baitsData, potionsData, petsData, eggsData, eventsData] =
    await Promise.all([
      safe(getFish,     { total: 0, fish:    [] }),
      safe(getRods,     { total: 0, rods:    [] }),
      safe(getBaits,    { total: 0, baits:   [] }),
      safe(getPotions,  { total: 0, potions: [] }),
      safe(getPets,     { total: 0, pets:    [] }),
      safe(getEggs,     { total: 0, eggs:    [] }),
      safe(getEvents,   { total: 0, events:  [] }),
    ]);

  return (
    <>
      <Navbar />
      <main>
        <WikiClient
          fish={fishData.fish}
          rods={rodsData.rods}
          baits={baitsData.baits}
          potions={potionsData.potions}
          pets={petsData.pets}
          eggs={eggsData.eggs}
          events={eventsData.events}
        />
      </main>
      <Footer />
    </>
  );
}
