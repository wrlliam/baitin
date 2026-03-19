import { env } from "~/env.js";
import type {
  BotBait,
  BotCommand,
  BotEgg,
  BotEvent,
  BotFish,
  BotPet,
  BotPotion,
  BotRod,
} from "~/types/bot";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${env.BOT_API_URL}/api${path}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bot API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getFish() {
  const d = await apiFetch<{
    success: boolean;
    data: { total: number; fish: BotFish[] };
  }>("/fish");
  return d.data;
}

export async function getRods() {
  const d = await apiFetch<{
    success: boolean;
    data: { total: number; rods: BotRod[] };
  }>("/rods");
  return d.data;
}

export async function getBaits() {
  const d = await apiFetch<{
    success: boolean;
    data: { total: number; baits: BotBait[] };
  }>("/baits");
  return d.data;
}

export async function getPotions() {
  const d = await apiFetch<{
    success: boolean;
    data: { total: number; potions: BotPotion[] };
  }>("/potions");
  return d.data;
}

export async function getPets() {
  const d = await apiFetch<{
    success: boolean;
    data: { total: number; pets: BotPet[] };
  }>("/pets");
  return d.data;
}

export async function getEggs() {
  const d = await apiFetch<{
    success: boolean;
    data: { total: number; eggs: BotEgg[] };
  }>("/eggs");
  return d.data;
}

export async function getEvents() {
  const d = await apiFetch<{
    success: boolean;
    data: { total: number; events: BotEvent[] };
  }>("/events");
  return d.data;
}

export async function getCommands() {
  const d = await apiFetch<{
    success: boolean;
    data: { total: number; commands: BotCommand[] };
  }>("/commands?limit=100");
  return d.data;
}
