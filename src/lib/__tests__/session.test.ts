import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { createSession, getSession, deleteSession } from "@/lib/session";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });

  // Create tables
  sqlite.exec(`
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE user_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT
    );
    CREATE TABLE user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      gmail_label TEXT DEFAULT 'Newsletters',
      onboarding_completed INTEGER DEFAULT 0
    );
  `);

  return db;
}

describe("session management", () => {
  it("creates a session and retrieves it by token", async () => {
    const db = createTestDb();
    const session = await createSession(db);
    expect(session.token).toBeDefined();
    expect(session.token.length).toBe(36); // UUID

    const found = await getSession(db, session.token);
    expect(found).toBeDefined();
    expect(found!.id).toBe(session.id);
  });

  it("returns null for invalid token", async () => {
    const db = createTestDb();
    const found = await getSession(db, "nonexistent");
    expect(found).toBeNull();
  });

  it("deletes a session", async () => {
    const db = createTestDb();
    const session = await createSession(db);
    await deleteSession(db, session.token);
    const found = await getSession(db, session.token);
    expect(found).toBeNull();
  });
});
