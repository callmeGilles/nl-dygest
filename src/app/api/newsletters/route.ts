import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { fetchNewsletters } from "@/lib/newsletters";
import { isAuthenticated } from "@/lib/gmail";
import { notInArray } from "drizzle-orm";

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const label = process.env.GMAIL_LABEL || "Newsletters";

  // Fetch from Gmail
  const gmailNewsletters = await fetchNewsletters(label);

  // Upsert into DB
  for (const nl of gmailNewsletters) {
    const existing = await db.query.newsletters.findFirst({
      where: (newsletters, { eq }) => eq(newsletters.gmailId, nl.gmailId),
    });
    if (!existing) {
      await db.insert(schema.newsletters).values(nl);
    }
  }

  // Return untriaged newsletters
  const triaged = db
    .select({ newsletterId: schema.triageDecisions.newsletterId })
    .from(schema.triageDecisions);

  const untriaged = await db.query.newsletters.findMany({
    where: notInArray(schema.newsletters.id, triaged),
    orderBy: (newsletters, { desc }) => [desc(newsletters.receivedAt)],
  });

  return NextResponse.json(untriaged);
}
