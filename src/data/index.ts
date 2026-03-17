import { fish } from "./fish";
import { junk } from "./junk";
import { baits } from "./baits";
import { rods } from "./rods";
import { pets, eggs } from "./pets";
import { events } from "./events";
import { sackTiers } from "./sack";
import { hutSpeedUpgrades, hutLuckUpgrades, hutInventoryUpgrades } from "./hut";
import type { BaseItem, Fish, JunkItem, Bait, Rod, Pet, Egg, GameEvent, SackTier, HutUpgrade } from "./types";

const fishMap = new Map<string, Fish>();
const junkMap = new Map<string, JunkItem>();
const baitMap = new Map<string, Bait>();
const rodMap = new Map<string, Rod>();
const petMap = new Map<string, Pet>();
const eggMap = new Map<string, Egg>();
const eventMap = new Map<string, GameEvent>();
const allItemsMap = new Map<string, BaseItem>();

function buildMaps() {
  fishMap.clear(); junkMap.clear(); baitMap.clear(); rodMap.clear();
  petMap.clear(); eggMap.clear(); eventMap.clear(); allItemsMap.clear();

  for (const f of fish) { fishMap.set(f.id, f); allItemsMap.set(f.id, f); }
  for (const j of junk) { junkMap.set(j.id, j); allItemsMap.set(j.id, j); }
  for (const b of baits) { baitMap.set(b.id, b); allItemsMap.set(b.id, b); }
  for (const r of rods) { rodMap.set(r.id, r); allItemsMap.set(r.id, r); }
  for (const p of pets) { petMap.set(p.id, p); }
  for (const e of eggs) { eggMap.set(e.id, e); allItemsMap.set(e.id, e); }
  for (const ev of events) { eventMap.set(ev.id, ev); }
}

buildMaps();

export const fishItems = fishMap;
export const junkItems = junkMap;
export const baitItems = baitMap;
export const rodItems = rodMap;
export const petItems = petMap;
export const eggItems = eggMap;
export const gameEvents = eventMap;
export const allItems = allItemsMap;

export { sackTiers } from "./sack";
export { hutSpeedUpgrades, hutLuckUpgrades, hutInventoryUpgrades } from "./hut";
export { fish } from "./fish";
export { junk } from "./junk";
export { baits } from "./baits";
export { rods } from "./rods";
export { pets, eggs } from "./pets";
export { events } from "./events";

export function getItem(id: string): BaseItem | undefined {
  return allItemsMap.get(id);
}

export function getItemsByCategory(cat: string): BaseItem[] {
  return Array.from(allItemsMap.values()).filter((i) => i.category === cat);
}

export function refreshData() {
  buildMaps();
}
