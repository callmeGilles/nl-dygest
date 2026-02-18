import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { fetchNewsletters } from "@/lib/newsletters";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { notInArray } from "drizzle-orm";

export async function GET() {
  const auth = await getAuthenticatedSession();

  if (auth?.tokens) {
    const label = auth.preferences?.gmailLabel || "Newsletters";
    const gmailNewsletters = await fetchNewsletters(
      label,
      20,
      auth.tokens.accessToken,
      auth.tokens.refreshToken
    );

    for (const nl of gmailNewsletters) {
      const existing = await db.query.newsletters.findFirst({
        where: (newsletters, { eq }) => eq(newsletters.gmailId, nl.gmailId),
      });
      if (!existing) {
        await db.insert(schema.newsletters).values(nl);
      }
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
