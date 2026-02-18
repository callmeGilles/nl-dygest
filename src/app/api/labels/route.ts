import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { getGmailClient } from "@/lib/gmail";

export async function GET() {
  const auth = await getAuthenticatedSession();
  if (!auth?.tokens) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const gmail = getGmailClient(auth.tokens.accessToken, auth.tokens.refreshToken);
  const response = await gmail.users.labels.list({ userId: "me" });
  const labels = response.data.labels || [];

  // Filter to user-created labels (exclude system labels like INBOX, SPAM, etc.)
  const userLabels = labels
    .filter((l) => l.type === "user")
    .map((l) => ({
      id: l.id,
      name: l.name,
      messagesTotal: l.messagesTotal || 0,
    }));

  return NextResponse.json(userLabels);
}
