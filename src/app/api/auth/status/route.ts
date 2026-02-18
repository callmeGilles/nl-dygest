import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth-helpers";

export async function GET() {
  const auth = await getAuthenticatedSession();

  if (!auth) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    hasTokens: !!auth.tokens,
    gmailLabel: auth.preferences?.gmailLabel || "Newsletters",
    onboardingCompleted: !!auth.preferences?.onboardingCompleted,
  });
}
