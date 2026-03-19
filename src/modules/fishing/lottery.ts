import { db } from "@/db";
import { lotteryDraw, lotteryTicket } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createId } from "@/utils/misc";
import { subtractCoins, addCoins } from "./economy";

const TICKET_PRICE = 100;
const MAX_TICKETS_PER_DRAW = 10;
const MIN_TICKETS_TO_DRAW = 5;

export async function getOrCreateCurrentDraw() {
  // Check for active draw
  const [active] = await db
    .select()
    .from(lotteryDraw)
    .where(eq(lotteryDraw.status, "active"))
    .limit(1);

  if (active) {
    // Check if draw time has passed
    if (new Date() >= active.drawAt) {
      if (active.totalTickets >= MIN_TICKETS_TO_DRAW) {
        return { draw: active, shouldDraw: true };
      }
      // Extend by 24h
      const newDrawAt = new Date(active.drawAt.getTime() + 24 * 60 * 60 * 1000);
      await db
        .update(lotteryDraw)
        .set({ drawAt: newDrawAt })
        .where(eq(lotteryDraw.id, active.id));
      return { draw: { ...active, drawAt: newDrawAt }, shouldDraw: false };
    }
    return { draw: active, shouldDraw: false };
  }

  // Create new draw at next midnight UTC
  const now = new Date();
  const drawAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  const draw = {
    id: createId(),
    totalPot: 0,
    totalTickets: 0,
    winnerId: null,
    status: "active",
    drawAt,
    createdAt: now,
  };

  await db.insert(lotteryDraw).values(draw);
  return { draw, shouldDraw: false };
}

export async function buyTickets(
  userId: string,
  count: number,
  drawId: string,
): Promise<{ success: boolean; error?: string; totalTickets?: number }> {
  if (count < 1 || count > MAX_TICKETS_PER_DRAW) {
    return { success: false, error: `You can buy 1-${MAX_TICKETS_PER_DRAW} tickets per draw.` };
  }

  // Check existing tickets for this draw
  const [existing] = await db
    .select()
    .from(lotteryTicket)
    .where(and(eq(lotteryTicket.drawId, drawId), eq(lotteryTicket.userId, userId)))
    .limit(1);

  const currentCount = existing?.ticketCount ?? 0;
  if (currentCount + count > MAX_TICKETS_PER_DRAW) {
    return {
      success: false,
      error: `You already have ${currentCount} tickets. Max is ${MAX_TICKETS_PER_DRAW} per draw.`,
    };
  }

  const cost = count * TICKET_PRICE;
  const paid = await subtractCoins(userId, cost);
  if (!paid) {
    return { success: false, error: `You need ${cost.toLocaleString()} coins for ${count} ticket(s).` };
  }

  if (existing) {
    await db
      .update(lotteryTicket)
      .set({ ticketCount: sql`${lotteryTicket.ticketCount} + ${count}` })
      .where(eq(lotteryTicket.id, existing.id));
  } else {
    await db.insert(lotteryTicket).values({
      id: createId(),
      userId,
      ticketCount: count,
      drawId,
    });
  }

  // Update draw pot
  await db
    .update(lotteryDraw)
    .set({
      totalPot: sql`${lotteryDraw.totalPot} + ${cost}`,
      totalTickets: sql`${lotteryDraw.totalTickets} + ${count}`,
    })
    .where(eq(lotteryDraw.id, drawId));

  return { success: true, totalTickets: currentCount + count };
}

export async function drawLottery(drawId: string): Promise<{
  winnerId: string;
  pot: number;
} | null> {
  const [draw] = await db
    .select()
    .from(lotteryDraw)
    .where(eq(lotteryDraw.id, drawId));

  if (!draw || draw.status !== "active") return null;

  const tickets = await db
    .select()
    .from(lotteryTicket)
    .where(eq(lotteryTicket.drawId, drawId));

  if (tickets.length === 0) return null;

  // Weighted random: more tickets = higher chance
  const totalTickets = tickets.reduce((sum, t) => sum + t.ticketCount, 0);
  let random = Math.random() * totalTickets;

  let winnerId = tickets[0].userId;
  for (const ticket of tickets) {
    random -= ticket.ticketCount;
    if (random <= 0) {
      winnerId = ticket.userId;
      break;
    }
  }

  // Award pot
  await addCoins(winnerId, draw.totalPot);

  // Mark completed
  await db
    .update(lotteryDraw)
    .set({ status: "completed", winnerId })
    .where(eq(lotteryDraw.id, drawId));

  return { winnerId, pot: draw.totalPot };
}

export { TICKET_PRICE, MAX_TICKETS_PER_DRAW };
