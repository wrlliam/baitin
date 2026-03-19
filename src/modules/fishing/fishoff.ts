import { doFish } from "./fishing";
import type { CatchResult } from "@/data/types";

export interface FishOffRound {
  p1Result: CatchResult;
  p2Result: CatchResult;
}

export async function runFishOffRound(p1Id: string, p2Id: string): Promise<FishOffRound> {
  const [p1Result, p2Result] = await Promise.all([
    doFish(p1Id),
    doFish(p2Id),
  ]);
  return { p1Result, p2Result };
}

export function scoreFishOff(rounds: FishOffRound[]): {
  p1Total: number;
  p2Total: number;
  winner: "player1" | "player2" | "draw";
} {
  let p1Total = 0;
  let p2Total = 0;

  for (const round of rounds) {
    p1Total += round.p1Result.item.price;
    p2Total += round.p2Result.item.price;
  }

  const winner = p1Total > p2Total ? "player1" : p2Total > p1Total ? "player2" : "draw";
  return { p1Total, p2Total, winner };
}
