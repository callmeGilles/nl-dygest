import { cookies } from "next/headers";
import { db } from "@/db";
import { getSession, getOAuthTokens, getPreferences } from "@/lib/session";

const SESSION_COOKIE = "nl-dygest-session";

export async function getAuthenticatedSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const session = await getSession(db, sessionToken);
  if (!session) return null;

  const tokens = await getOAuthTokens(db, session.id);
  const preferences = await getPreferences(db, session.id);

  return { session, tokens, preferences };
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
