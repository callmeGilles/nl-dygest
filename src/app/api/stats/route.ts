import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql, count, eq } from "drizzle-orm";

export async function GET() {
  // Total newsletters in DB
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.newsletters);

  // Total triaged
  const [{ triaged }] = await db
    .select({ triaged: count() })
    .from(schema.triageDecisions);

  // Total kept
  const [{ kept }] = await db
    .select({ kept: count() })
    .from(schema.triageDecisions)
    .where(eq(schema.triageDecisions.decision, "kept"));

  // Reading sessions (last 7 days)
  const sessions = await db.query.readingSessions.findMany({
    orderBy: (s, { desc }) => [desc(s.date)],
    limit: 30,
  });

  // Calculate streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < sessions.length; i++) {
    const sessionDate = new Date(sessions[i].date);
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    if (sessionDate.toDateString() === expectedDate.toDateString()) {
      streak++;
    } else {
      break;
    }
  }

  // Editions count
  const [{ editions }] = await db
    .select({ editions: count() })
    .from(schema.editions);

  return NextResponse.json({
    total,
    triaged,
    kept,
    remaining: total - triaged,
    streak,
    editions,
    recentSessions: sessions.slice(0, 7),
  });
}
