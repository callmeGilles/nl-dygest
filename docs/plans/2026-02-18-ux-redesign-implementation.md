# UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild all pages with shadcn/ui, fix Google SSO with session management, add 3-step onboarding, redesign newspaper with slide-over reading pane, and polish triage + stats.

**Architecture:** Keep the existing Next.js 16 App Router + Drizzle ORM + SQLite backend. Replace all UI components with shadcn/ui. Add session-based auth (cookie + DB). Add new onboarding route. Redesign newspaper as two-panel layout with reading pane.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Radix primitives), Tailwind CSS 4, Drizzle ORM, SQLite, framer-motion (swipe physics), googleapis

**Design doc:** `docs/plans/2026-02-18-ux-redesign-design.md`

---

### Task 1: Install and configure shadcn/ui

**Files:**
- Modify: `package.json`
- Create: `src/lib/utils.ts`
- Modify: `src/app/globals.css`
- Modify: `tsconfig.json`
- Create: `components.json`

**Step 1: Install shadcn/ui and dependencies**

Run:
```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

This will create `components.json`, update `globals.css` with CSS variables, and add `src/lib/utils.ts` with the `cn()` helper.

**Step 2: Install initial shadcn components we'll need**

Run:
```bash
npx shadcn@latest add button card sheet skeleton progress badge separator scroll-area
```

**Step 3: Install framer-motion for swipe physics and animations**

Run:
```bash
npm install framer-motion
```

**Step 4: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: install shadcn/ui, framer-motion, and initial components"
```

---

### Task 2: Add auth DB tables and session management

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/lib/session.ts`
- Modify: `src/lib/gmail.ts`
- Test: `src/lib/__tests__/session.test.ts`

**Step 1: Write failing test for session management**

Create `src/lib/__tests__/session.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
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
  it("creates a session and retrieves it by token", () => {
    const db = createTestDb();
    const session = createSession(db);
    expect(session.token).toBeDefined();
    expect(session.token.length).toBe(36); // UUID

    const found = getSession(db, session.token);
    expect(found).toBeDefined();
    expect(found!.id).toBe(session.id);
  });

  it("returns null for invalid token", () => {
    const db = createTestDb();
    const found = getSession(db, "nonexistent");
    expect(found).toBeNull();
  });

  it("deletes a session", () => {
    const db = createTestDb();
    const session = createSession(db);
    deleteSession(db, session.token);
    const found = getSession(db, session.token);
    expect(found).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/session.test.ts`
Expected: FAIL — modules don't exist yet.

**Step 3: Add new tables to the schema**

Modify `src/db/schema.ts` — add after the existing tables:

```typescript
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const userTokens = sqliteTable("user_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: text("expires_at"),
});

export const userPreferences = sqliteTable("user_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id),
  gmailLabel: text("gmail_label").default("Newsletters"),
  onboardingCompleted: integer("onboarding_completed").default(0),
});
```

**Step 4: Create session management library**

Create `src/lib/session.ts`:

```typescript
import { eq, and, gt } from "drizzle-orm";
import * as schema from "@/db/schema";
import crypto from "crypto";

type DbInstance = any; // Drizzle instance

export function createSession(db: DbInstance): { id: number; token: string } {
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const [session] = db
    .insert(schema.sessions)
    .values({
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    .returning();

  // Create default preferences
  db.insert(schema.userPreferences)
    .values({ sessionId: session.id })
    .run();

  return { id: session.id, token };
}

export function getSession(db: DbInstance, token: string) {
  const session = db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.token, token),
      gt(schema.sessions.expiresAt, new Date().toISOString())
    ),
  });
  return session || null;
}

export function deleteSession(db: DbInstance, token: string) {
  db.delete(schema.sessions).where(eq(schema.sessions.token, token)).run();
}

export function storeOAuthTokens(
  db: DbInstance,
  sessionId: number,
  tokens: { access_token: string; refresh_token?: string; expiry_date?: number }
) {
  db.insert(schema.userTokens)
    .values({
      sessionId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
    })
    .run();
}

export function getOAuthTokens(db: DbInstance, sessionId: number) {
  return db.query.userTokens.findFirst({
    where: eq(schema.userTokens.sessionId, sessionId),
  });
}

export function getPreferences(db: DbInstance, sessionId: number) {
  return db.query.userPreferences.findFirst({
    where: eq(schema.userPreferences.sessionId, sessionId),
  });
}

export function updatePreferences(
  db: DbInstance,
  sessionId: number,
  updates: { gmailLabel?: string; onboardingCompleted?: number }
) {
  db.update(schema.userPreferences)
    .set(updates)
    .where(eq(schema.userPreferences.sessionId, sessionId))
    .run();
}
```

**Step 5: Update gmail.ts to support DB-based tokens**

Modify `src/lib/gmail.ts` to accept tokens as parameters instead of reading from file:

```typescript
import { google } from "googleapis";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback"
  );
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.modify"],
    prompt: "consent",
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function getGmailClient(accessToken: string, refreshToken?: string | null) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.gmail({ version: "v1", auth: oauth2Client });
}
```

**Step 6: Run tests**

Run: `npm test -- src/lib/__tests__/session.test.ts`
Expected: PASS

**Step 7: Generate and run migration**

Run:
```bash
npm run db:generate
npm run db:migrate
```

**Step 8: Commit**

```bash
git add src/db/schema.ts src/lib/session.ts src/lib/gmail.ts src/lib/__tests__/session.test.ts
git commit -m "feat: add session-based auth with DB token storage"
```

---

### Task 3: Update auth API routes to use sessions

**Files:**
- Modify: `src/app/api/auth/route.ts`
- Modify: `src/app/api/auth/callback/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/status/route.ts`
- Create: `src/lib/auth-helpers.ts`

**Step 1: Create auth helper for extracting session from cookies**

Create `src/lib/auth-helpers.ts`:

```typescript
import { cookies } from "next/headers";
import { db } from "@/db";
import { getSession, getOAuthTokens, getPreferences } from "@/lib/session";

const SESSION_COOKIE = "briefflow-session";

export async function getAuthenticatedSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const session = getSession(db, sessionToken);
  if (!session) return null;

  const tokens = getOAuthTokens(db, session.id);
  const preferences = getPreferences(db, session.id);

  return { session, tokens, preferences };
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
```

**Step 2: Update auth route**

Rewrite `src/app/api/auth/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail";

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
```

(This stays the same — it just redirects to Google.)

**Step 3: Update callback route to create session + store tokens**

Rewrite `src/app/api/auth/callback/route.ts`:

```typescript
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
  const session = createSession(db);

  storeOAuthTokens(db, session.id, {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token || undefined,
    expiry_date: tokens.expiry_date || undefined,
  });

  const preferences = getPreferences(db, session.id);
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
```

**Step 4: Create logout route**

Create `src/app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession } from "@/lib/session";
import { getSessionCookieName } from "@/lib/auth-helpers";
import { db } from "@/db";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (token) {
    deleteSession(db, token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(getSessionCookieName());
  return response;
}
```

**Step 5: Create auth status route**

Create `src/app/api/auth/status/route.ts`:

```typescript
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
```

**Step 6: Update newsletter and edition API routes to use session tokens**

Modify `src/app/api/newsletters/route.ts` — replace `isAuthenticated()` with session-based auth and pass tokens to gmail client:

```typescript
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

  const triaged = db
    .select({ newsletterId: schema.triageDecisions.newsletterId })
    .from(schema.triageDecisions);

  const untriaged = await db.query.newsletters.findMany({
    where: notInArray(schema.newsletters.id, triaged),
    orderBy: (newsletters, { desc }) => [desc(newsletters.receivedAt)],
  });

  return NextResponse.json(untriaged);
}
```

**Step 7: Update newsletters.ts to accept tokens as parameters**

Modify `src/lib/newsletters.ts` — update `fetchNewsletters`, `markAsRead`, and `addLabel` to accept token params instead of calling `getGmailClient()`:

```typescript
import { getGmailClient } from "./gmail";

// ... keep parseGmailMessage and helpers unchanged ...

export async function fetchNewsletters(
  label: string,
  maxResults = 20,
  accessToken: string,
  refreshToken?: string | null
): Promise<ParsedNewsletter[]> {
  const gmail = getGmailClient(accessToken, refreshToken);
  // ... rest of implementation stays the same but uses this gmail instance
}

export async function markAsRead(gmailId: string, accessToken: string, refreshToken?: string | null) {
  const gmail = getGmailClient(accessToken, refreshToken);
  // ... rest stays the same
}

export async function addLabel(gmailId: string, labelName: string, accessToken: string, refreshToken?: string | null) {
  const gmail = getGmailClient(accessToken, refreshToken);
  // ... rest stays the same
}
```

**Step 8: Update triage route to pass tokens**

Modify `src/app/api/newsletters/triage/route.ts` to get tokens from session and pass them to `markAsRead`/`addLabel`.

**Step 9: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 10: Commit**

```bash
git add src/app/api/ src/lib/auth-helpers.ts src/lib/newsletters.ts
git commit -m "feat: wire auth API routes to session-based token management"
```

---

### Task 4: Add Next.js auth middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create middleware**

Create `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/api/auth", "/api/auth/callback"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionToken = request.cookies.get("briefflow-session")?.value;
  if (!sessionToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware to protect routes"
```

---

### Task 5: Create new landing page with Google SSO

**Files:**
- Rewrite: `src/app/page.tsx`

**Step 1: Rewrite the home/landing page**

Replace `src/app/page.tsx` with a clean landing page that has Google sign-in:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900">
            briefflow
          </h1>
          <p className="text-lg text-slate-500">
            Your daily newsletter companion
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <p className="text-sm text-slate-600 max-w-xs mx-auto">
            Triage your newsletters with a swipe. Read the digest, not the noise.
          </p>

          <Button asChild size="lg" className="w-full max-w-xs rounded-xl h-12 text-base">
            <Link href="/api/auth">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </Link>
          </Button>
        </div>

        <p className="text-xs text-slate-400 pt-8">
          Connect your Gmail to get started
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Verify it renders**

Run: `npm run dev`
Visit: `http://localhost:3000`
Expected: Clean landing page with Google sign-in button.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign landing page with Google SSO button"
```

---

### Task 6: Create Gmail label picker API route

**Files:**
- Create: `src/app/api/labels/route.ts`

**Step 1: Create labels API**

Create `src/app/api/labels/route.ts`:

```typescript
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
```

**Step 2: Commit**

```bash
git add src/app/api/labels/route.ts
git commit -m "feat: add Gmail labels API endpoint"
```

---

### Task 7: Create onboarding preferences API route

**Files:**
- Create: `src/app/api/preferences/route.ts`

**Step 1: Create preferences API**

Create `src/app/api/preferences/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { updatePreferences } from "@/lib/session";
import { db } from "@/db";

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const updates: { gmailLabel?: string; onboardingCompleted?: number } = {};

  if (body.gmailLabel) updates.gmailLabel = body.gmailLabel;
  if (body.onboardingCompleted !== undefined) {
    updates.onboardingCompleted = body.onboardingCompleted ? 1 : 0;
  }

  updatePreferences(db, auth.session.id, updates);

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/preferences/route.ts
git commit -m "feat: add preferences API for onboarding"
```

---

### Task 8: Build the onboarding pages

**Files:**
- Create: `src/app/onboarding/label/page.tsx`
- Create: `src/app/onboarding/layout.tsx`
- Create: `src/components/onboarding-stepper.tsx`
- Create: `src/components/label-picker.tsx`

**Step 1: Create onboarding layout with stepper**

Create `src/app/onboarding/layout.tsx`:

```tsx
import { OnboardingStepper } from "@/components/onboarding-stepper";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">briefflow</h1>
          <p className="text-sm text-slate-500">Set up your newsletter digest</p>
        </div>
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Create stepper component**

Create `src/components/onboarding-stepper.tsx`:

```tsx
interface OnboardingStepperProps {
  currentStep: number;
  steps: string[];
}

export function OnboardingStepper({ currentStep, steps }: OnboardingStepperProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-sm ${
            i <= currentStep ? "text-slate-900" : "text-slate-400"
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              i < currentStep
                ? "bg-slate-900 text-white"
                : i === currentStep
                ? "border-2 border-slate-900 text-slate-900"
                : "border border-slate-300 text-slate-400"
            }`}>
              {i < currentStep ? "✓" : i + 1}
            </div>
            <span className="hidden sm:inline">{step}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < currentStep ? "bg-slate-900" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Create label picker component**

Create `src/components/label-picker.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingStepper } from "./onboarding-stepper";

interface Label {
  id: string;
  name: string;
  messagesTotal: number;
}

export function LabelPicker() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/labels")
      .then((r) => r.json())
      .then((data) => {
        setLabels(data);
        // Auto-select "Newsletters" if it exists
        const newsletters = data.find(
          (l: Label) => l.name.toLowerCase() === "newsletters"
        );
        if (newsletters) setSelected(newsletters.name);
        setLoading(false);
      });
  }, []);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmailLabel: selected }),
    });
    router.push("/triage");
  };

  return (
    <div className="space-y-6">
      <OnboardingStepper currentStep={1} steps={["Connect", "Select", "Triage"]} />

      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">Choose your newsletter folder</h2>
        <p className="text-sm text-slate-500 mt-1">
          Select the Gmail label that contains your newsletters
        </p>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : (
          labels.map((label) => (
            <Card
              key={label.id}
              className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                selected === label.name
                  ? "ring-2 ring-slate-900 bg-slate-50"
                  : "hover:bg-slate-50"
              }`}
              onClick={() => setSelected(label.name)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{label.name}</span>
                <span className="text-sm text-slate-400">
                  {label.messagesTotal} messages
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!selected || saving}
        className="w-full rounded-xl h-12 text-base"
        size="lg"
      >
        {saving ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}
```

**Step 4: Create label picker page**

Create `src/app/onboarding/label/page.tsx`:

```tsx
import { LabelPicker } from "@/components/label-picker";

export default function OnboardingLabelPage() {
  return <LabelPicker />;
}
```

**Step 5: Verify it renders**

Run: `npm run dev`
Visit: `http://localhost:3000/onboarding/label` (after auth)
Expected: Label picker renders with Gmail labels.

**Step 6: Commit**

```bash
git add src/app/onboarding/ src/components/onboarding-stepper.tsx src/components/label-picker.tsx
git commit -m "feat: add onboarding flow with Gmail label picker"
```

---

### Task 9: Rebuild the navigation and layout

**Files:**
- Rewrite: `src/app/layout.tsx`
- Create: `src/components/nav-bar.tsx`

**Step 1: Create navigation component**

Create `src/components/nav-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/triage", label: "Triage" },
  { href: "/read", label: "Dygest" },
  { href: "/stats", label: "Stats" },
];

export function NavBar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <Link href="/" className="font-bold text-lg text-slate-900 tracking-tight">
        briefflow
      </Link>
      <div className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith(item.href)
                ? "bg-slate-100 text-slate-900"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <div className="w-px h-5 bg-slate-200 mx-2" />
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500">
          Sign out
        </Button>
      </div>
    </nav>
  );
}
```

**Step 2: Update layout to conditionally show nav**

Rewrite `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "briefflow",
  description: "Your daily newsletter companion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

Create a separate layout for authenticated pages that includes the NavBar. Create `src/app/(app)/layout.tsx`:

```tsx
import { NavBar } from "@/components/nav-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
    </>
  );
}
```

Then move `triage/`, `read/`, and `stats/` pages under `src/app/(app)/`.

**Step 3: Restructure routes**

Move:
- `src/app/triage/page.tsx` → `src/app/(app)/triage/page.tsx`
- `src/app/read/[id]/page.tsx` → `src/app/(app)/read/[id]/page.tsx`
- `src/app/stats/page.tsx` → `src/app/(app)/stats/page.tsx`

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds. Nav bar appears on app pages, not on landing/onboarding.

**Step 5: Commit**

```bash
git add src/app/ src/components/nav-bar.tsx
git commit -m "feat: rebuild navigation with route groups and shadcn/ui"
```

---

### Task 10: Redesign the triage page

**Files:**
- Rewrite: `src/app/(app)/triage/page.tsx`
- Rewrite: `src/components/triage-card.tsx`
- Delete: `src/components/progress-bar.tsx` (replaced by shadcn Progress)

**Step 1: Rewrite triage card with framer-motion**

Rewrite `src/components/triage-card.tsx`:

```tsx
"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { Card } from "@/components/ui/card";

interface Newsletter {
  id: number;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

interface TriageCardProps {
  newsletter: Newsletter;
  onDecision: (decision: "kept" | "skipped") => void;
}

export function TriageCard({ newsletter, onDecision }: TriageCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const keepOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-100, 0], [1, 0]);

  const date = new Date(newsletter.receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const senderInitial = newsletter.sender.charAt(0).toUpperCase();

  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto touch-none"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > 120) {
          onDecision("kept");
        } else if (info.offset.x < -120) {
          onDecision("skipped");
        }
      }}
    >
      <Card className="p-6 min-h-[320px] flex flex-col rounded-2xl shadow-lg border-0 bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600">
            {senderInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {newsletter.sender}
            </p>
            <p className="text-xs text-slate-400">{date}</p>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3 leading-snug">
          {newsletter.subject}
        </h2>
        <p className="text-sm text-slate-500 leading-relaxed flex-grow line-clamp-4">
          {newsletter.snippet}
        </p>
      </Card>

      {/* Swipe indicators */}
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-green-400 bg-green-50/30 flex items-center justify-center pointer-events-none"
        style={{ opacity: keepOpacity }}
      >
        <span className="text-2xl font-bold text-green-600">KEEP</span>
      </motion.div>
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-red-400 bg-red-50/30 flex items-center justify-center pointer-events-none"
        style={{ opacity: skipOpacity }}
      >
        <span className="text-2xl font-bold text-red-600">SKIP</span>
      </motion.div>
    </motion.div>
  );
}
```

**Step 2: Rewrite triage page**

Rewrite `src/app/(app)/triage/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TriageCard } from "@/components/triage-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface Newsletter {
  id: number;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

export default function TriagePage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [keptCount, setKeptCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/newsletters")
      .then((r) => r.json())
      .then((data) => {
        setNewsletters(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  const handleDecision = useCallback(
    async (decision: "kept" | "skipped") => {
      const newsletter = newsletters[currentIndex];
      await fetch("/api/newsletters/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterId: newsletter.id, decision }),
      });
      if (decision === "kept") setKeptCount((c) => c + 1);
      else setSkippedCount((c) => c + 1);
      setCurrentIndex((i) => i + 1);
    },
    [newsletters, currentIndex]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (currentIndex >= newsletters.length) return;
      if (e.key === "ArrowRight") handleDecision("kept");
      if (e.key === "ArrowLeft") handleDecision("skipped");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDecision, currentIndex, newsletters.length]);

  const handleGenerate = async () => {
    const res = await fetch("/api/editions", { method: "POST" });
    const data = await res.json();
    if (data.editionId) {
      router.push(`/read/${data.editionId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 gap-4">
        <Skeleton className="w-full max-w-sm h-80 rounded-2xl" />
        <div className="flex gap-4">
          <Skeleton className="w-24 h-12 rounded-xl" />
          <Skeleton className="w-24 h-12 rounded-xl" />
        </div>
      </div>
    );
  }

  if (newsletters.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <p className="text-lg text-slate-500">No newsletters to triage.</p>
        <p className="text-sm text-slate-400 mt-1">Check back later or connect a different label.</p>
      </div>
    );
  }

  const isDone = currentIndex >= newsletters.length;
  const progress = (currentIndex / newsletters.length) * 100;

  return (
    <div className="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center p-4">
      {!isDone ? (
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>{currentIndex + 1} of {newsletters.length}</span>
              <span>Kept: {keptCount} · Skipped: {skippedCount}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <TriageCard
            key={newsletters[currentIndex].id}
            newsletter={newsletters[currentIndex]}
            onDecision={handleDecision}
          />

          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleDecision("skipped")}
              className="rounded-xl w-28 h-12 text-red-600 border-red-200 hover:bg-red-50"
            >
              Skip
            </Button>
            <Button
              size="lg"
              onClick={() => handleDecision("kept")}
              className="rounded-xl w-28 h-12 bg-green-600 hover:bg-green-700"
            >
              Keep
            </Button>
          </div>

          <p className="text-xs text-slate-400 text-center">← skip · keep →</p>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <h2 className="text-xl font-semibold text-slate-900">All done!</h2>
          <p className="text-slate-500">
            Kept {keptCount} · Skipped {skippedCount}
          </p>
          <Button
            size="lg"
            onClick={handleGenerate}
            className="rounded-xl h-12 px-8 text-base"
          >
            Generate my dygest
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Delete old progress bar**

Delete `src/components/progress-bar.tsx` (replaced by shadcn Progress).

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/app/ src/components/triage-card.tsx
git rm src/components/progress-bar.tsx
git commit -m "feat: redesign triage with framer-motion swipe and shadcn/ui"
```

---

### Task 11: Redesign the newspaper/dygest page with slide-over

**Files:**
- Rewrite: `src/app/(app)/read/[id]/page.tsx`
- Create: `src/components/article-list.tsx`
- Create: `src/components/reading-pane.tsx`
- Rewrite: `src/components/article-card.tsx`
- Delete: `src/components/stats-bar.tsx`
- Modify: `src/app/api/editions/[id]/route.ts` (add rawHtml to response)

**Step 1: Update editions API to include rawHtml for reading pane**

Modify `src/app/api/editions/[id]/route.ts` to join newsletter data:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const editionId = parseInt(id);

  const edition = await db.query.editions.findFirst({
    where: eq(schema.editions.id, editionId),
  });

  if (!edition) {
    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  }

  const articles = await db.query.editionArticles.findMany({
    where: eq(schema.editionArticles.editionId, editionId),
  });

  // Fetch newsletter data for each article (for reading pane)
  const articlesWithContent = await Promise.all(
    articles.map(async (article) => {
      const newsletter = await db.query.newsletters.findFirst({
        where: eq(schema.newsletters.id, article.newsletterId),
      });
      return {
        ...article,
        sender: newsletter?.sender || "",
        rawHtml: newsletter?.rawHtml || "",
        receivedAt: newsletter?.receivedAt || "",
      };
    })
  );

  // Group by category
  const grouped: Record<string, typeof articlesWithContent> = {};
  for (const article of articlesWithContent) {
    if (!grouped[article.category]) grouped[article.category] = [];
    grouped[article.category].push(article);
  }

  return NextResponse.json({ edition, articles: grouped });
}
```

**Step 2: Create article list component (left panel)**

Create `src/components/article-list.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  sender: string;
  category: string;
}

interface ArticleListProps {
  articles: Record<string, Article[]>;
  selectedId: number | null;
  onSelect: (article: Article) => void;
}

export function ArticleList({ articles, selectedId, onSelect }: ArticleListProps) {
  return (
    <ScrollArea className="h-[calc(100vh-64px)]">
      <div className="p-4 space-y-6">
        {Object.entries(articles).map(([category, categoryArticles]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white/90 backdrop-blur-sm py-1">
              <Badge variant="secondary" className="text-xs font-medium">
                {category}
              </Badge>
              <span className="text-xs text-slate-400">{categoryArticles.length}</span>
            </div>
            <div className="space-y-2">
              {categoryArticles.map((article) => (
                <Card
                  key={article.id}
                  onClick={() => onSelect(article)}
                  className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md border-l-2 ${
                    selectedId === article.id
                      ? "border-l-slate-900 bg-slate-50 shadow-sm"
                      : "border-l-transparent hover:bg-slate-50"
                  }`}
                >
                  <h3 className={`text-sm leading-snug mb-1 ${
                    selectedId === article.id ? "font-semibold" : "font-medium"
                  } text-slate-900`}>
                    {article.headline}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{article.readingTime} min</span>
                    <span>·</span>
                    <span className="truncate">{article.sender}</span>
                  </div>
                </Card>
              ))}
            </div>
            <Separator className="mt-4" />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
```

**Step 3: Create reading pane component (right panel)**

Create `src/components/reading-pane.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  sender: string;
  rawHtml: string;
  receivedAt: string;
  category: string;
}

interface ReadingPaneProps {
  article: Article;
  onClose: () => void;
}

export function ReadingPane({ article, onClose }: ReadingPaneProps) {
  const [showFull, setShowFull] = useState(false);
  const keyPoints = JSON.parse(article.keyPoints) as string[];
  const date = new Date(article.receivedAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <ScrollArea className="h-[calc(100vh-64px)]">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{article.category}</Badge>
              <span className="text-xs text-slate-400">{article.readingTime} min read</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              {article.headline}
            </h1>
            <p className="text-sm text-slate-500">
              {article.sender} · {date}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400">
            ✕
          </Button>
        </div>

        <Separator />

        {/* Summary */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Digest
          </h2>
          <p className="text-base text-slate-700 leading-relaxed">
            {article.summary}
          </p>
        </div>

        {/* Key Points */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Key Points
          </h2>
          <ul className="space-y-2">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-600">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {/* Full newsletter */}
        <div>
          <Button
            variant="outline"
            onClick={() => setShowFull(!showFull)}
            className="w-full rounded-xl"
          >
            {showFull ? "Hide full newsletter" : "Read full newsletter"}
          </Button>
          {showFull && (
            <div
              className="mt-4 prose prose-slate prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: article.rawHtml }}
            />
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
```

**Step 4: Rewrite the newspaper page with two-panel layout**

Rewrite `src/app/(app)/read/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArticleList } from "@/components/article-list";
import { ReadingPane } from "@/components/reading-pane";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface Article {
  id: number;
  headline: string;
  summary: string;
  keyPoints: string;
  readingTime: number;
  newsletterId: number;
  sender: string;
  rawHtml: string;
  receivedAt: string;
  category: string;
}

interface EditionData {
  edition: { id: number; generatedAt: string };
  articles: Record<string, Article[]>;
}

export default function NewspaperPage() {
  const params = useParams();
  const [data, setData] = useState<EditionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    fetch(`/api/editions/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [params.id]);

  if (loading || !data) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-96 border-r p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  const date = new Date(data.edition.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const totalArticles = Object.values(data.articles).flat().length;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left panel — article list */}
      <div className="w-96 border-r border-slate-200 bg-white hidden md:block">
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-900">
            Edition #{data.edition.id}
          </h1>
          <p className="text-xs text-slate-400">
            {date} · {totalArticles} articles
          </p>
        </div>
        <ArticleList
          articles={data.articles}
          selectedId={selectedArticle?.id || null}
          onSelect={setSelectedArticle}
        />
      </div>

      {/* Mobile list (when no article selected) */}
      <div className="md:hidden flex-1">
        {!selectedArticle && (
          <>
            <div className="p-4 border-b border-slate-200">
              <h1 className="text-lg font-bold text-slate-900">
                Edition #{data.edition.id}
              </h1>
              <p className="text-xs text-slate-400">
                {date} · {totalArticles} articles
              </p>
            </div>
            <ArticleList
              articles={data.articles}
              selectedId={null}
              onSelect={setSelectedArticle}
            />
          </>
        )}
      </div>

      {/* Right panel — reading pane (desktop) */}
      <div className="flex-1 bg-white hidden md:block">
        {selectedArticle ? (
          <ReadingPane
            article={selectedArticle}
            onClose={() => setSelectedArticle(null)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <p>Select an article to read</p>
          </div>
        )}
      </div>

      {/* Mobile reading pane (sheet) */}
      <Sheet open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <SheetContent side="bottom" className="h-[90vh] md:hidden p-0">
          {selectedArticle && (
            <ReadingPane
              article={selectedArticle}
              onClose={() => setSelectedArticle(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

**Step 5: Create a dygest index page**

Create `src/app/(app)/read/page.tsx` that redirects to latest edition:

```tsx
import { redirect } from "next/navigation";
import { db, schema } from "@/db";

export default async function ReadIndexPage() {
  const latestEdition = await db.query.editions.findFirst({
    orderBy: (editions, { desc }) => [desc(editions.generatedAt)],
  });

  if (latestEdition) {
    redirect(`/read/${latestEdition.id}`);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-lg text-slate-500">No editions yet</p>
        <p className="text-sm text-slate-400">Triage some newsletters first</p>
      </div>
    </div>
  );
}
```

**Step 6: Delete old components**

Delete `src/components/article-card.tsx` and `src/components/stats-bar.tsx`.

**Step 7: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 8: Commit**

```bash
git add src/app/ src/components/article-list.tsx src/components/reading-pane.tsx
git rm src/components/article-card.tsx src/components/stats-bar.tsx
git commit -m "feat: redesign newspaper with two-panel layout and slide-over reading pane"
```

---

### Task 12: Redesign the stats page

**Files:**
- Rewrite: `src/app/(app)/stats/page.tsx`
- Create: `src/components/stat-card.tsx`

**Step 1: Create stat card component**

Create `src/components/stat-card.tsx`:

```tsx
import { Card } from "@/components/ui/card";

interface StatCardProps {
  value: number;
  label: string;
  icon: string;
  color: "orange" | "blue" | "green" | "slate";
}

const colorMap = {
  orange: "text-orange-500",
  blue: "text-blue-600",
  green: "text-green-600",
  slate: "text-slate-700",
};

export function StatCard({ value, label, icon, color }: StatCardProps) {
  return (
    <Card className="p-6 rounded-2xl border-0 shadow-sm bg-white">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-bold ${colorMap[color]}`}>{value}</span>
      </div>
      <p className="text-sm text-slate-500">{label}</p>
    </Card>
  );
}
```

**Step 2: Rewrite stats page**

Rewrite `src/app/(app)/stats/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface Stats {
  total: number;
  triaged: number;
  kept: number;
  remaining: number;
  streak: number;
  editions: number;
  recentSessions: Array<{
    date: string;
    newslettersRead: number;
    timeSpent: number;
  }>;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your reading stats</h1>
        <p className="text-sm text-slate-500 mt-1">Track your newsletter habits</p>
      </div>

      {/* Reading habits */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard value={stats.streak} label="Day streak" icon="🔥" color="orange" />
        <StatCard value={stats.editions} label="Editions generated" icon="📰" color="blue" />
        <StatCard value={stats.kept} label="Newsletters read" icon="✓" color="green" />
        <StatCard value={stats.remaining} label="Remaining" icon="📬" color="slate" />
      </div>

      <Separator />

      {/* Recent activity */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
        {stats.recentSessions.length > 0 ? (
          <div className="space-y-2">
            {stats.recentSessions.map((session) => (
              <Card
                key={session.date}
                className="flex items-center justify-between p-4 rounded-xl border-0 shadow-sm"
              >
                <span className="text-sm font-medium text-slate-700">{session.date}</span>
                <span className="text-sm text-slate-400">
                  {session.newslettersRead} read · {session.timeSpent} min
                </span>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 rounded-xl border-0 shadow-sm text-center">
            <p className="text-sm text-slate-400">No reading sessions yet. Start triaging!</p>
          </Card>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/ src/components/stat-card.tsx
git commit -m "feat: redesign stats page with stat cards and shadcn/ui"
```

---

### Task 13: Add smart landing for returning users

**Files:**
- Modify: `src/app/(app)/layout.tsx` or create redirect logic

**Step 1: Create a redirect page for authenticated users**

The middleware already checks for session cookies. Now add smart redirect logic. Modify the root page (`src/app/page.tsx`) to check auth status and redirect:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("briefflow-session")?.value;

  if (sessionToken) {
    // Authenticated user — redirect to dygest
    redirect("/read");
  }

  return (
    // ... landing page JSX (same as Task 5)
  );
}
```

**Step 2: Verify flow**

1. Unauthenticated → sees landing page
2. After login, onboarding incomplete → `/onboarding/label`
3. After onboarding → `/triage`
4. Returning user → `/read` (latest edition)

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add smart landing redirect for returning users"
```

---

### Task 14: Mark onboarding complete after first edition

**Files:**
- Modify: `src/app/(app)/triage/page.tsx`

**Step 1: Update handleGenerate to mark onboarding complete**

In the triage page, after generating the first edition, call the preferences API:

```typescript
const handleGenerate = async () => {
  const res = await fetch("/api/editions", { method: "POST" });
  const data = await res.json();
  if (data.editionId) {
    // Mark onboarding as complete
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true }),
    });
    router.push(`/read/${data.editionId}`);
  }
};
```

**Step 2: Commit**

```bash
git add src/app/
git commit -m "feat: mark onboarding complete after first edition generation"
```

---

### Task 15: Final cleanup and verify full flow

**Files:**
- Clean up unused imports across all modified files
- Delete `.gmail-tokens.json` reference from `.gitignore` (optional)
- Update `src/db/seed.ts` to seed new tables if needed

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass.

**Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Manual test the full flow**

1. Visit `/` → landing page with Google SSO
2. Click "Sign in with Google" → OAuth flow
3. Redirected to `/onboarding/label` → pick label
4. Redirected to `/triage` → swipe cards
5. Generate edition → `/read/[id]` with two-panel layout
6. Click article → reading pane with summary + full content
7. Navigate to `/stats` → stat cards
8. Sign out → back to landing

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: final cleanup and verify full flow"
```

---

### Task 16: Generate and run DB migration

**Step 1: Generate migration**

Run:
```bash
npm run db:generate
```

**Step 2: Run migration**

Run:
```bash
npm run db:migrate
```

**Step 3: Commit migration files**

```bash
git add drizzle/
git commit -m "chore: add database migration for sessions and preferences tables"
```
