import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { updatePreferences } from "@/lib/session";
import { db } from "@/db";

export async function GET() {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json(auth.preferences || {});
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const updates: { gmailLabel?: string; gmailLabels?: string; onboardingCompleted?: number } = {};

  if (body.gmailLabel) updates.gmailLabel = body.gmailLabel;
  if (body.gmailLabels) {
    updates.gmailLabels = JSON.stringify(body.gmailLabels);
  }
  if (body.onboardingCompleted !== undefined) {
    updates.onboardingCompleted = body.onboardingCompleted ? 1 : 0;
  }

  await updatePreferences(db, auth.session.id, updates);

  return NextResponse.json({ success: true });
}
