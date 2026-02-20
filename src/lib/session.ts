import { eq, and, gt } from "drizzle-orm";
import * as schema from "@/db/schema";
import crypto from "crypto";

type DbInstance = any; // Drizzle instance

export async function createSession(db: DbInstance): Promise<{ id: number; token: string }> {
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const [session] = await db
    .insert(schema.sessions)
    .values({
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    .returning();

  // Create default preferences
  await db.insert(schema.userPreferences)
    .values({ sessionId: session.id });

  return { id: session.id, token };
}

export async function getSession(db: DbInstance, token: string) {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.token, token),
      gt(schema.sessions.expiresAt, new Date().toISOString())
    ),
  });
  return session || null;
}

export async function deleteSession(db: DbInstance, token: string) {
  const session = await getSession(db, token);
  if (session) {
    await db.delete(schema.userTokens).where(eq(schema.userTokens.sessionId, session.id));
    await db.delete(schema.userPreferences).where(eq(schema.userPreferences.sessionId, session.id));
  }
  await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
}

export async function storeOAuthTokens(
  db: DbInstance,
  sessionId: number,
  tokens: { access_token: string; refresh_token?: string; expiry_date?: number }
) {
  await db.insert(schema.userTokens)
    .values({
      sessionId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    });
}

export async function getOAuthTokens(db: DbInstance, sessionId: number) {
  return db.query.userTokens.findFirst({
    where: eq(schema.userTokens.sessionId, sessionId),
  });
}

export async function getPreferences(db: DbInstance, sessionId: number) {
  return db.query.userPreferences.findFirst({
    where: eq(schema.userPreferences.sessionId, sessionId),
  });
}

export async function updatePreferences(
  db: DbInstance,
  sessionId: number,
  updates: { gmailLabel?: string; gmailLabels?: string; onboardingCompleted?: number }
) {
  await db.update(schema.userPreferences)
    .set(updates)
    .where(eq(schema.userPreferences.sessionId, sessionId));
}
