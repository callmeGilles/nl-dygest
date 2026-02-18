import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/gmail";
import { createSession, storeOAuthTokens, getPreferences } from "@/lib/session";
import { getSessionCookieName } from "@/lib/auth-helpers";
import { db } from "@/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const tokens = await getTokensFromCode(code);
  const session = await createSession(db);

  await storeOAuthTokens(db, session.id, {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token || undefined,
    expiry_date: tokens.expiry_date || undefined,
  });

  const preferences = await getPreferences(db, session.id);
  const redirectUrl = preferences?.onboardingCompleted
    ? "/triage"
    : "/onboarding/label";

  const response = NextResponse.redirect(new URL(redirectUrl, request.url));
  response.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return response;
}
