export type DuelChoice = "net" | "hook" | "bait";
export type DuelResult = "player1" | "player2" | "draw";

// Fishing-themed RPS: Net > Hook > Bait > Net
const WINS_AGAINST: Record<DuelChoice, DuelChoice> = {
  net: "hook",
  hook: "bait",
  bait: "net",
};

export function resolveDuel(choice1: DuelChoice, choice2: DuelChoice): DuelResult {
  if (choice1 === choice2) return "draw";
  if (WINS_AGAINST[choice1] === choice2) return "player1";
  return "player2";
}

export const DUEL_CHOICE_EMOJI: Record<DuelChoice, string> = {
  net: "🥅",
  hook: "🪝",
  bait: "🪱",
};

export const DUEL_CHOICE_LABEL: Record<DuelChoice, string> = {
  net: "Net",
  hook: "Hook",
  bait: "Bait",
};
