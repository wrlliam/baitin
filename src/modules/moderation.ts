import { db } from "@/db";
import { userBan, userReport } from "@/db/schema";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { createId } from "@/utils/misc";

// ── Duration parsing ──────────────────────────────────────────────────────────

const DURATION_RE = /^(\d+(?:\.\d+)?)(s|m|h|d|w)$/i;
const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export function parseDuration(input: string): number | null {
  const match = input.match(DURATION_RE);
  if (!match) return null;
  const ms = parseFloat(match[1]) * UNIT_MS[match[2].toLowerCase()];
  return ms > 0 ? ms : null;
}

export function formatDuration(ms: number): string {
  if (ms >= 604_800_000) return `${(ms / 604_800_000).toFixed(1).replace(/\.0$/, "")}w`;
  if (ms >= 86_400_000) return `${(ms / 86_400_000).toFixed(1).replace(/\.0$/, "")}d`;
  if (ms >= 3_600_000) return `${(ms / 3_600_000).toFixed(1).replace(/\.0$/, "")}h`;
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1).replace(/\.0$/, "")}m`;
  return `${(ms / 1_000).toFixed(0)}s`;
}

// ── Restriction checks ────────────────────────────────────────────────────────

export type Restriction = {
  restricted: true;
  type: "ban" | "timeout";
  reason: string | null;
  expiresAt: Date | null;
} | { restricted: false };

export async function isUserRestricted(userId: string): Promise<Restriction> {
  const now = new Date();

  const row = await db.query.userBan.findFirst({
    where: and(
      eq(userBan.userId, userId),
      eq(userBan.active, true),
    ),
    orderBy: [desc(userBan.createdAt)],
  });

  if (!row) return { restricted: false };

  // Expire timed-out rows automatically
  if (row.expiresAt && row.expiresAt <= now) {
    await db.update(userBan).set({ active: false }).where(eq(userBan.id, row.id));
    return { restricted: false };
  }

  return {
    restricted: true,
    type: row.type as "ban" | "timeout",
    reason: row.reason,
    expiresAt: row.expiresAt,
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function banUser(userId: string, issuedBy: string, reason?: string) {
  await db.update(userBan).set({ active: false }).where(eq(userBan.userId, userId));
  await db.insert(userBan).values({
    id: createId(),
    userId,
    type: "ban",
    issuedBy,
    reason: reason ?? null,
    active: true,
    expiresAt: null,
  });
}

export async function timeoutUser(
  userId: string,
  issuedBy: string,
  durationMs: number,
  reason?: string,
) {
  const expiresAt = new Date(Date.now() + durationMs);
  await db.update(userBan).set({ active: false }).where(eq(userBan.userId, userId));
  await db.insert(userBan).values({
    id: createId(),
    userId,
    type: "timeout",
    issuedBy,
    reason: reason ?? null,
    active: true,
    expiresAt,
  });
}

export async function unrestrictUser(userId: string): Promise<boolean> {
  const result = await db
    .update(userBan)
    .set({ active: false })
    .where(and(eq(userBan.userId, userId), eq(userBan.active, true)));
  return (result as any).rowCount > 0;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function submitReport(
  reporterId: string,
  targetId: string,
  reason: string,
  evidence?: string,
) {
  await db.insert(userReport).values({
    id: createId(),
    reporterId,
    targetId,
    reason,
    evidence: evidence ?? null,
    status: "open",
  });
}

export async function getReportsForUser(targetId: string) {
  return db
    .select()
    .from(userReport)
    .where(eq(userReport.targetId, targetId))
    .orderBy(desc(userReport.createdAt));
}
