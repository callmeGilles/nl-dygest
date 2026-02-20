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
  const userLabels = labels.filter((l) => l.type === "user");

  // Fetch individual label details to get accurate message counts
  const detailed = await Promise.all(
    userLabels.map(async (l) => {
      try {
        const detail = await gmail.users.labels.get({
          userId: "me",
          id: l.id!,
        });
        return {
          id: detail.data.id,
          name: detail.data.name,
          messagesTotal: detail.data.messagesTotal || 0,
        };
      } catch {
        return {
          id: l.id,
          name: l.name,
          messagesTotal: 0,
        };
      }
    })
  );

  return NextResponse.json(detailed);
}
