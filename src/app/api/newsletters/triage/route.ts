import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { markAsRead, addLabel } from "@/lib/newsletters";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const { newsletterId, decision } = await request.json();

  if (!newsletterId || !["kept", "skipped"].includes(decision)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Save decision
  await db.insert(schema.triageDecisions).values({
    newsletterId,
    decision,
    triagedAt: new Date().toISOString(),
  });

  // Sync with Gmail if authenticated
  const auth = await getAuthenticatedSession();
  if (auth?.tokens) {
    const newsletter = await db.query.newsletters.findFirst({
      where: eq(schema.newsletters.id, newsletterId),
    });

    if (newsletter) {
      if (decision === "skipped") {
        await markAsRead(newsletter.gmailId, auth.tokens.accessToken, auth.tokens.refreshToken);
      } else {
        await addLabel(newsletter.gmailId, "briefflow/kept", auth.tokens.accessToken, auth.tokens.refreshToken);
      }
    }
  }

  return NextResponse.json({ success: true });
}
