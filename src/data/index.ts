import { fish } from "./fish";
import { junk } from "./junk";
import { baits } from "./baits";
import { rods } from "./rods";
import { pets, eggs } from "./pets";
import { events } from "./events";
import { potions } from "./potions";
import { sackTiers } from "./sack";
import { hutSpeedUpgrades, hutLuckUpgrades, hutInventoryUpgrades } from "./hut";
import { allExclusiveFish } from "./locations";
import { seasonalFish } from "./seasonal-fish";
import type { BaseItem, Fish, JunkItem, Bait, Rod, Pet, Egg, GameEvent, SackTier, HutUpgrade, Potion } from "./types";

const fishMap = new Map<string, Fish>();
const junkMap = new Map<string, JunkItem>();
const baitMap = new Map<string, Bait>();
const rodMap = new Map<string, Rod>();
const petMap = new Map<string, Pet>();
const eggMap = new Map<string, Egg>();
const eventMap = new Map<string, GameEvent>();
const potionMap = new Map<string, Potion>();
const allItemsMap = new Map<string, BaseItem>();

function buildMaps() {
  fishMap.clear(); junkMap.clear(); baitMap.clear(); rodMap.clear();
  petMap.clear(); eggMap.clear(); eventMap.clear(); potionMap.clear(); allItemsMap.clear();

  for (const f of fish) { fishMap.set(f.id, f); allItemsMap.set(f.id, f); }
  for (const j of junk) { junkMap.set(j.id, j); allItemsMap.set(j.id, j); }
  for (const b of baits) { baitMap.set(b.id, b); allItemsMap.set(b.id, b); }
  for (const r of rods) { rodMap.set(r.id, r); allItemsMap.set(r.id, r); }
  for (const p of pets) { petMap.set(p.id, p); }
  for (const e of eggs) { eggMap.set(e.id, e); allItemsMap.set(e.id, e); }
  for (const ev of events) { eventMap.set(ev.id, ev); }
  for (const po of potions) { potionMap.set(po.id, po); allItemsMap.set(po.id, po); }
  for (const ef of allExclusiveFish) { fishMap.set(ef.id, ef); allItemsMap.set(ef.id, ef); }
  for (const sf of seasonalFish) { fishMap.set(sf.id, sf); allItemsMap.set(sf.id, sf); }
}

buildMaps();

export const fishItems = fishMap;
export const junkItems = junkMap;
export const baitItems = baitMap;
export const rodItems = rodMap;
export const petItems = petMap;
export const eggItems = eggMap;
export const gameEvents = eventMap;
export const potionItems = potionMap;
export const allItems = allItemsMap;

export { sackTiers } from "./sack";
export { hutSpeedUpgrades, hutLuckUpgrades, hutInventoryUpgrades } from "./hut";
export { fish } from "./fish";
export { junk } from "./junk";
export { baits } from "./baits";
export { rods } from "./rods";
export { pets, eggs } from "./pets";
export { events } from "./events";
export { potions } from "./potions";

export function getItem(id: string): BaseItem | undefined {
  return allItemsMap.get(id);
}

export function getItemsByCategory(cat: string): BaseItem[] {
  return Array.from(allItemsMap.values()).filter((i) => i.category === cat);
}

export function refreshData() {
  buildMaps();
}
