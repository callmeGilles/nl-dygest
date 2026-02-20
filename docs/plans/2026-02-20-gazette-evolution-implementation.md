# Gazette Evolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat random gazette with an interest-driven 3-tier editorial gazette (Headline / Worth Your Time / In Brief) powered by a single Gemini "editor" call.

**Architecture:** Evolve the existing Next.js + SQLite + Drizzle + Gemini stack. Add a `userInterests` table and new `section`/`position`/`expandedSummary` columns to `editionArticles`. Replace `selectRandomNewsletters()` + per-article SSE streaming with a single Gemini call that selects and structures the gazette. Update onboarding to support multi-label selection and interest topic picking. Build new 3-tier gazette UI components with a warmer visual theme.

**Tech Stack:** Next.js 16, React 19, TypeScript, SQLite + Drizzle ORM, Gemini Flash, Tailwind CSS 4, shadcn/ui, Framer Motion

**Design doc:** `docs/plans/2026-02-20-gazette-evolution-design.md`

---

### Task 1: Schema — Add `userInterests` table and update `editionArticles`

**Files:**
- Modify: `src/db/schema.ts`
- Test: `src/db/__tests__/schema.test.ts`

**Step 1: Write the failing test**

Add to `src/db/__tests__/schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { userInterests, editionArticles } from "@/db/schema";

describe("userInterests schema", () => {
  it("exports userInterests table with expected columns", () => {
    expect(userInterests).toBeDefined();
    const columns = Object.keys(userInterests);
    expect(columns).toContain("id");
    expect(columns).toContain("sessionId");
    expect(columns).toContain("topic");
    expect(columns).toContain("createdAt");
  });
});

describe("editionArticles schema additions", () => {
  it("has section, position, and expandedSummary columns", () => {
    const columns = Object.keys(editionArticles);
    expect(columns).toContain("section");
    expect(columns).toContain("position");
    expect(columns).toContain("expandedSummary");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/__tests__/schema.test.ts`
Expected: FAIL — `userInterests` not exported, columns missing

**Step 3: Implement schema changes**

In `src/db/schema.ts`, add at the end:

```typescript
export const userInterests = sqliteTable("user_interests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id),
  topic: text("topic").notNull(),
  createdAt: text("created_at").notNull(),
});
```

Update `editionArticles` — add three columns:

```typescript
section: text("section"),          // 'headline' | 'worth_your_time' | 'in_brief'
position: integer("position"),     // order within section
expandedSummary: text("expanded_summary"),  // longer summary for expand view
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/db/__tests__/schema.test.ts`
Expected: PASS

**Step 5: Generate and apply migration**

Run: `npm run db:generate && npm run db:migrate`

**Step 6: Commit**

```bash
git add src/db/schema.ts src/db/__tests__/schema.test.ts drizzle/
git commit -m "feat: add userInterests table and gazette section columns"
```

---

### Task 2: Schema — Update `userPreferences` for multi-label support

**Files:**
- Modify: `src/db/schema.ts`

**Step 1: Update schema**

In `src/db/schema.ts`, change `userPreferences`:

```typescript
// Change gmailLabel from single string to JSON array of labels
gmailLabels: text("gmail_labels").default('["Newsletters"]'),
```

Keep `gmailLabel` column for backward compatibility during migration, but code will use `gmailLabels` going forward.

**Step 2: Generate and apply migration**

Run: `npm run db:generate && npm run db:migrate`

**Step 3: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: multi-label support in userPreferences"
```

---

### Task 3: API — Interests CRUD endpoint

**Files:**
- Create: `src/app/api/interests/route.ts`
- Test: `src/__tests__/interests-api.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/interests-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the interest storage logic directly rather than the API route
// since Next.js route handlers need request context
import { userInterests } from "@/db/schema";

describe("userInterests table structure", () => {
  it("has the required columns for interest storage", () => {
    const columns = Object.keys(userInterests);
    expect(columns).toContain("sessionId");
    expect(columns).toContain("topic");
    expect(columns).toContain("createdAt");
  });
});
```

**Step 2: Run test to verify it passes** (schema already updated in Task 1)

Run: `npx vitest run src/__tests__/interests-api.test.ts`
Expected: PASS

**Step 3: Create the API route**

Create `src/app/api/interests/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";

// GET — fetch user's interests
export async function GET() {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const interests = await db.query.userInterests.findMany({
    where: eq(schema.userInterests.sessionId, auth.session.id),
  });

  return NextResponse.json(interests.map((i) => i.topic));
}

// PUT — replace all interests (used during onboarding)
export async function PUT(request: NextRequest) {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { topics } = await request.json();

  if (!Array.isArray(topics) || topics.length < 3 || topics.length > 8) {
    return NextResponse.json(
      { error: "Provide 3-8 topics" },
      { status: 400 }
    );
  }

  // Delete existing interests
  await db
    .delete(schema.userInterests)
    .where(eq(schema.userInterests.sessionId, auth.session.id));

  // Insert new ones
  const now = new Date().toISOString();
  await db.insert(schema.userInterests).values(
    topics.map((topic: string) => ({
      sessionId: auth.session.id,
      topic: topic.trim(),
      createdAt: now,
    }))
  );

  return NextResponse.json({ success: true });
}
```

**Step 4: Commit**

```bash
git add src/app/api/interests/route.ts src/__tests__/interests-api.test.ts
git commit -m "feat: interests CRUD API endpoint"
```

---

### Task 4: API — Update preferences endpoint for multi-label

**Files:**
- Modify: `src/app/api/preferences/route.ts`
- Modify: `src/lib/session.ts`

**Step 1: Update `session.ts` to handle `gmailLabels`**

In `src/lib/session.ts`, update `updatePreferences`:

```typescript
export async function updatePreferences(
  db: DbInstance,
  sessionId: number,
  updates: { gmailLabel?: string; gmailLabels?: string; onboardingCompleted?: number }
) {
  await db.update(schema.userPreferences)
    .set(updates)
    .where(eq(schema.userPreferences.sessionId, sessionId));
}
```

**Step 2: Update `preferences/route.ts`**

Add `gmailLabels` handling:

```typescript
if (body.gmailLabels) {
  updates.gmailLabels = JSON.stringify(body.gmailLabels);
}
```

**Step 3: Commit**

```bash
git add src/app/api/preferences/route.ts src/lib/session.ts
git commit -m "feat: multi-label preferences support"
```

---

### Task 5: Gazette generation — Single Gemini "editor" call

**Files:**
- Create: `src/lib/gazette-generator.ts`
- Modify: `src/lib/summarize.ts` (add `extractReadableContent` export — already exported, verify)
- Test: `src/__tests__/gazette-generator.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/gazette-generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildGazettePrompt, parseGazetteResponse } from "@/lib/gazette-generator";

const mockCandidates = [
  {
    id: 1,
    sender: "Lenny Rachitsky <lenny@substack.com>",
    subject: "Why onboarding fails",
    receivedAt: "2026-02-19T10:00:00Z",
    contentExcerpt: "Analysis of 50+ B2B SaaS companies shows...",
  },
  {
    id: 2,
    sender: "Gergely Orosz <gergely@pragmaticengineer.com>",
    subject: "Stripe's billing rewrite",
    receivedAt: "2026-02-18T10:00:00Z",
    contentExcerpt: "Stripe spent 3 years rewriting their billing engine...",
  },
];

const mockInterests = ["Product Management", "Engineering", "AI"];

describe("buildGazettePrompt", () => {
  it("includes user interests in the prompt", () => {
    const prompt = buildGazettePrompt(mockCandidates, mockInterests);
    expect(prompt).toContain("Product Management");
    expect(prompt).toContain("Engineering");
    expect(prompt).toContain("AI");
  });

  it("includes candidate newsletter data", () => {
    const prompt = buildGazettePrompt(mockCandidates, mockInterests);
    expect(prompt).toContain("Lenny Rachitsky");
    expect(prompt).toContain("Stripe's billing rewrite");
  });

  it("includes section instructions", () => {
    const prompt = buildGazettePrompt(mockCandidates, mockInterests);
    expect(prompt).toContain("HEADLINE");
    expect(prompt).toContain("WORTH YOUR TIME");
    expect(prompt).toContain("IN BRIEF");
  });
});

describe("parseGazetteResponse", () => {
  it("parses a valid gazette JSON response", () => {
    const json = JSON.stringify({
      headline: {
        newsletterId: 1,
        interestTag: "Product",
        title: "Test headline",
        summary: "Test summary sentence one. Two. Three.",
        takeaways: ["Point 1", "Point 2"],
      },
      worthYourTime: [
        {
          newsletterId: 2,
          interestTag: "Engineering",
          hook: "A compelling hook.",
          expandedSummary: "Longer summary here.",
          takeaways: ["Point 1"],
        },
      ],
      inBrief: [],
    });

    const result = parseGazetteResponse(json);
    expect(result.headline.title).toBe("Test headline");
    expect(result.worthYourTime).toHaveLength(1);
    expect(result.worthYourTime[0].hook).toBe("A compelling hook.");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseGazetteResponse("not json")).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/gazette-generator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `gazette-generator.ts`**

Create `src/lib/gazette-generator.ts`:

```typescript
import { GoogleGenAI } from "@google/genai";
import { extractReadableContent } from "./summarize";

let _ai: GoogleGenAI | null = null;
function getAI() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _ai;
}

export interface GazetteCandidate {
  id: number;
  sender: string;
  subject: string;
  receivedAt: string;
  contentExcerpt: string;
}

export interface GazetteHeadline {
  newsletterId: number;
  interestTag: string;
  title: string;
  summary: string;
  takeaways: string[];
}

export interface GazetteWorthYourTime {
  newsletterId: number;
  interestTag: string;
  hook: string;
  expandedSummary: string;
  takeaways: string[];
}

export interface GazetteInBrief {
  newsletterId: number;
  interestTag: string;
  oneLiner: string;
  expandedSummary: string;
}

export interface GazetteContent {
  headline: GazetteHeadline;
  worthYourTime: GazetteWorthYourTime[];
  inBrief: GazetteInBrief[];
}

export function buildGazettePrompt(
  candidates: GazetteCandidate[],
  interests: string[]
): string {
  const candidateBlocks = candidates
    .map(
      (c, i) => `--- Newsletter ${i + 1} ---
ID: ${c.id}
From: ${c.sender}
Subject: ${c.subject}
Date: ${c.receivedAt}
Content:
${c.contentExcerpt}
---`
    )
    .join("\n\n");

  return `You are the editor of a personal newsletter gazette. Your job is to select the most valuable newsletters for this reader and present them in a structured briefing.

## Reader Profile
Interests: ${interests.join(", ")}

## Candidate Newsletters (${candidates.length} available)
${candidateBlocks}

## Your Task

Select 7-10 newsletters and assign them to sections:

1. **HEADLINE** (exactly 1): The single most valuable, relevant, and interesting piece today. Pick content that would make the reader glad they opened the gazette.

2. **WORTH YOUR TIME** (2-3): Strong content the reader should consider reading in full. For each, write a HOOK — one sentence that creates curiosity and makes the reader want to tap. Do NOT write a summary. Write a hook. Good: "Stripe just rewrote their entire billing engine — the architectural choices explain why most billing systems fail." Bad: "This newsletter discusses Stripe's billing system changes."

3. **IN BRIEF** (4-6): Content worth knowing about but not worth deep reading today. One sentence each — give the reader the gist.

## Rules
- Ensure topic diversity: don't pick 5 newsletters about the same thing
- Be specific in summaries: names, numbers, concrete claims. Never write "this newsletter discusses..."
- Hooks must create curiosity. Not summaries. Not descriptions.
- If a newsletter is clearly outdated or time-sensitive and expired, skip it
- If fewer than 7 candidates are available, adjust section sizes (minimum: 1 headline + 1-2 others)
- Output valid JSON only. No markdown, no commentary.

## Output Format

{
  "headline": {
    "newsletterId": <number>,
    "interestTag": "<matching interest or general topic>",
    "title": "<compelling title, can be rewritten from subject>",
    "summary": "<3 specific sentences with data points and names>",
    "takeaways": ["<takeaway 1>", "<takeaway 2>", "<takeaway 3>"]
  },
  "worthYourTime": [
    {
      "newsletterId": <number>,
      "interestTag": "<topic>",
      "hook": "<one curiosity-creating sentence>",
      "expandedSummary": "<3-4 sentences with key details>",
      "takeaways": ["<takeaway 1>", "<takeaway 2>"]
    }
  ],
  "inBrief": [
    {
      "newsletterId": <number>,
      "interestTag": "<topic>",
      "oneLiner": "<one sentence gist>",
      "expandedSummary": "<2-3 sentences for optional expanded view>"
    }
  ]
}`;
}

export function parseGazetteResponse(text: string): GazetteContent {
  const parsed = JSON.parse(text);

  if (!parsed.headline || !parsed.headline.newsletterId) {
    throw new Error("Invalid gazette: missing headline");
  }

  return {
    headline: parsed.headline,
    worthYourTime: parsed.worthYourTime || [],
    inBrief: parsed.inBrief || [],
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateGazette(
  candidates: GazetteCandidate[],
  interests: string[]
): Promise<GazetteContent> {
  const prompt = buildGazettePrompt(candidates, interests);

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text ?? "";
      return parseGazetteResponse(text);
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("429") ||
          err.message.includes("RESOURCE_EXHAUSTED") ||
          err.message.includes("503") ||
          err.message.includes("UNAVAILABLE"));
      if (isRetryable && attempt < maxRetries) {
        const delay = (attempt + 1) * 10_000;
        console.log(`Rate limited, retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

export function prepareCandidates(
  newsletters: Array<{
    id: number;
    sender: string;
    subject: string;
    receivedAt: string;
    rawHtml: string;
  }>,
  limit = 30
): GazetteCandidate[] {
  return newsletters.slice(0, limit).map((nl) => ({
    id: nl.id,
    sender: nl.sender,
    subject: nl.subject,
    receivedAt: nl.receivedAt,
    contentExcerpt: extractReadableContent(nl.rawHtml).slice(0, 2000),
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/gazette-generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/gazette-generator.ts src/__tests__/gazette-generator.test.ts
git commit -m "feat: gazette generator with single Gemini editor call"
```

---

### Task 6: API — Rewrite gazette route to use new generator

**Files:**
- Modify: `src/app/api/gazette/route.ts`
- Delete (or keep as dead code for reference): `src/app/api/gazette/[id]/stream/route.ts`

**Step 1: Rewrite `src/app/api/gazette/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, notInArray, desc } from "drizzle-orm";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { fetchNewsletters } from "@/lib/newsletters";
import {
  generateGazette,
  prepareCandidates,
  GazetteContent,
} from "@/lib/gazette-generator";

export async function POST() {
  try {
    const auth = await getAuthenticatedSession();
    if (!auth?.tokens) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if gazette already exists for today
    const today = new Date().toISOString().split("T")[0];
    const existingEditions = await db.query.editions.findMany({
      orderBy: (editions, { desc }) => [desc(editions.generatedAt)],
    });
    const todayEdition = existingEditions.find(
      (e) => e.generatedAt.split("T")[0] === today
    );

    if (todayEdition) {
      return NextResponse.json({
        editionId: todayEdition.id,
        status: "ready",
      });
    }

    // Get user's labels (multi-label support)
    const prefs = auth.preferences;
    let labels: string[] = ["Newsletters"];
    if (prefs?.gmailLabels) {
      try {
        labels = JSON.parse(prefs.gmailLabels);
      } catch {
        labels = [prefs.gmailLabel || "Newsletters"];
      }
    } else if (prefs?.gmailLabel) {
      labels = [prefs.gmailLabel];
    }

    // Fetch newsletters from all selected labels
    const allGmailNewsletters = [];
    for (const label of labels) {
      const newsletters = await fetchNewsletters(
        label,
        50,
        auth.tokens.accessToken,
        auth.tokens.refreshToken
      );
      allGmailNewsletters.push(...newsletters);
    }

    // Deduplicate by gmailId
    const seen = new Set<string>();
    const uniqueNewsletters = allGmailNewsletters.filter((nl) => {
      if (seen.has(nl.gmailId)) return false;
      seen.add(nl.gmailId);
      return true;
    });

    // Store new newsletters in DB
    for (const nl of uniqueNewsletters) {
      const existing = await db.query.newsletters.findFirst({
        where: eq(schema.newsletters.gmailId, nl.gmailId),
      });
      if (!existing) {
        await db.insert(schema.newsletters).values(nl);
      }
    }

    // Get all newsletters not yet in any edition
    const existingArticles = await db.query.editionArticles.findMany();
    const processedNlIds = new Set(existingArticles.map((a) => a.newsletterId));

    const allNewsletters = await db.query.newsletters.findMany({
      orderBy: (newsletters, { desc }) => [desc(newsletters.receivedAt)],
    });
    const available = allNewsletters.filter((nl) => !processedNlIds.has(nl.id));

    if (available.length === 0) {
      return NextResponse.json(
        { error: "No unread newsletters available" },
        { status: 400 }
      );
    }

    // Get user interests
    const interests = await db.query.userInterests.findMany({
      where: eq(schema.userInterests.sessionId, auth.session.id),
    });
    const interestTopics = interests.map((i) => i.topic);

    // Prepare candidates and generate gazette
    const candidates = prepareCandidates(available);
    const gazette = await generateGazette(
      candidates,
      interestTopics.length > 0 ? interestTopics : ["General"]
    );

    // Create edition
    const [edition] = await db
      .insert(schema.editions)
      .values({ generatedAt: new Date().toISOString() })
      .returning();

    // Store gazette articles
    const storeArticle = async (
      newsletterId: number,
      section: string,
      position: number,
      headline: string,
      summary: string,
      keyPoints: string[],
      expandedSummary: string | null
    ) => {
      // Find the matching interest tag for the category field
      await db.insert(schema.editionArticles).values({
        editionId: edition.id,
        newsletterId,
        category: section === "headline" ? "Featured" : "General",
        section,
        position,
        headline,
        summary,
        keyPoints: JSON.stringify(keyPoints),
        expandedSummary,
        readingTime: 0,
      });
    };

    // Store headline
    await storeArticle(
      gazette.headline.newsletterId,
      "headline",
      0,
      gazette.headline.title,
      gazette.headline.summary,
      gazette.headline.takeaways,
      null
    );

    // Store worth your time
    for (let i = 0; i < gazette.worthYourTime.length; i++) {
      const item = gazette.worthYourTime[i];
      await storeArticle(
        item.newsletterId,
        "worth_your_time",
        i,
        item.hook,
        item.hook,
        item.takeaways,
        item.expandedSummary
      );
    }

    // Store in brief
    for (let i = 0; i < gazette.inBrief.length; i++) {
      const item = gazette.inBrief[i];
      await storeArticle(
        item.newsletterId,
        "in_brief",
        i,
        item.oneLiner,
        item.oneLiner,
        [],
        item.expandedSummary
      );
    }

    return NextResponse.json({
      editionId: edition.id,
      status: "ready",
    });
  } catch (error) {
    console.error("Gazette generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
```

**Step 2: Update `src/app/api/editions/[id]/route.ts`**

Return articles grouped by section instead of category:

```typescript
// Group by section instead of category
const grouped: Record<string, typeof articlesWithContent> = {};
for (const article of articlesWithContent) {
  const section = article.section || "in_brief";
  if (!grouped[section]) grouped[section] = [];
  grouped[section].push(article);
}

// Sort within each section by position
for (const section of Object.values(grouped)) {
  section.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}
```

**Step 3: Delete the SSE streaming route**

Delete `src/app/api/gazette/[id]/stream/route.ts` — no longer needed.

**Step 4: Commit**

```bash
git add src/app/api/gazette/route.ts src/app/api/editions/[id]/route.ts
git rm src/app/api/gazette/[id]/stream/route.ts
git commit -m "feat: gazette uses single Gemini editor call, remove SSE streaming"
```

---

### Task 7: Onboarding — Multi-label selection

**Files:**
- Modify: `src/components/label-picker.tsx`

**Step 1: Update `LabelPicker` for multi-select**

Key changes:
- `selected` becomes `string[]` instead of `string | null`
- Click toggles label in/out of array
- Min 1, max 3 labels
- Save as `gmailLabels` (JSON array) instead of `gmailLabel`
- Update stepper steps to `["Connect", "Labels", "Interests"]`

```typescript
const [selected, setSelected] = useState<string[]>([]);

// Auto-select "Newsletters" label
useEffect(() => {
  // ... existing fetch ...
  const newsletters = data.find((l: Label) => l.name.toLowerCase() === "newsletters");
  if (newsletters) setSelected([newsletters.name]);
}, []);

const toggleLabel = (name: string) => {
  setSelected((prev) =>
    prev.includes(name)
      ? prev.filter((n) => n !== name)
      : prev.length < 3
        ? [...prev, name]
        : prev
  );
};

const handleContinue = async () => {
  if (selected.length === 0) return;
  setSaving(true);
  await fetch("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gmailLabels: selected }),
  });
  router.push("/onboarding/interests");
};
```

Update card rendering to show multi-select state (checkmark when selected).

Update stepper: `steps={["Connect", "Labels", "Interests"]}` and `currentStep={1}`.

**Step 2: Commit**

```bash
git add src/components/label-picker.tsx
git commit -m "feat: multi-label selection in onboarding"
```

---

### Task 8: Onboarding — Interest picker screen

**Files:**
- Create: `src/app/onboarding/interests/page.tsx`
- Create: `src/components/interest-picker.tsx`

**Step 1: Create `InterestPicker` component**

Create `src/components/interest-picker.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "./onboarding-stepper";
import { X } from "lucide-react";

const SUGGESTED_TOPICS = [
  "AI", "SaaS", "Startups", "Product", "Engineering",
  "Marketing", "Finance", "Design", "Leadership",
  "Health", "Climate", "Crypto",
];

export function InterestPicker() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const toggleTopic = (topic: string) => {
    setSelected((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : prev.length < 8
          ? [...prev, topic]
          : prev
    );
  };

  const addCustom = () => {
    const topic = customInput.trim();
    if (topic && !selected.includes(topic) && selected.length < 8) {
      setSelected((prev) => [...prev, topic]);
      setCustomInput("");
    }
  };

  const handleContinue = async () => {
    if (selected.length < 3) return;
    setSaving(true);
    await fetch("/api/interests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics: selected }),
    });
    router.push("/gazette");
  };

  return (
    <div className="space-y-6">
      <OnboardingStepper currentStep={2} steps={["Connect", "Labels", "Interests"]} />

      <div className="text-center">
        <h2 className="text-xl font-semibold text-stone-900">
          What topics matter to you?
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          Pick 3-8 topics. We'll use these to curate your gazette.
        </p>
      </div>

      {/* Suggested chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        {SUGGESTED_TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() => toggleTopic(topic)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selected.includes(topic)
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add your own..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
        <Button
          variant="outline"
          onClick={addCustom}
          disabled={!customInput.trim() || selected.length >= 8}
          className="rounded-xl"
        >
          Add
        </Button>
      </div>

      {/* Selected custom topics (remove button) */}
      {selected.filter((t) => !SUGGESTED_TOPICS.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected
            .filter((t) => !SUGGESTED_TOPICS.includes(t))
            .map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-stone-900 text-white"
              >
                {topic}
                <button onClick={() => toggleTopic(topic)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
      )}

      {/* Counter */}
      <p className="text-center text-xs text-stone-400">
        {selected.length}/8 selected {selected.length < 3 && `(${3 - selected.length} more needed)`}
      </p>

      <Button
        onClick={handleContinue}
        disabled={selected.length < 3 || saving}
        className="w-full rounded-xl h-12 text-base"
        size="lg"
      >
        {saving ? "Saving..." : "Start reading"}
      </Button>
    </div>
  );
}
```

**Step 2: Create the route page**

Create `src/app/onboarding/interests/page.tsx`:

```typescript
import { InterestPicker } from "@/components/interest-picker";

export default function OnboardingInterestsPage() {
  return <InterestPicker />;
}
```

**Step 3: Commit**

```bash
git add src/app/onboarding/interests/page.tsx src/components/interest-picker.tsx
git commit -m "feat: interest picker onboarding screen"
```

---

### Task 9: UI — HeadlineCard component

**Files:**
- Create: `src/components/headline-card.tsx`

**Step 1: Create `HeadlineCard`**

This is the dominant card for Section 1. Warm, inviting, large typography.

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

interface HeadlineCardProps {
  interestTag: string;
  title: string;
  summary: string;
  takeaways: string[];
  sender: string;
  receivedAt: string;
  onReadFull: () => void;
}

export function HeadlineCard({
  interestTag,
  title,
  summary,
  takeaways,
  sender,
  receivedAt,
  onReadFull,
}: HeadlineCardProps) {
  const date = new Date(receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <article className="bg-gradient-to-br from-amber-50/80 to-orange-50/40 rounded-2xl p-6 shadow-sm border border-amber-100/60">
      {/* Interest tag */}
      <Badge className="bg-amber-100 text-amber-800 text-xs font-medium border-0 mb-4">
        {interestTag}
      </Badge>

      {/* Title */}
      <h2 className="text-2xl font-bold text-stone-900 leading-tight mb-3">
        {title}
      </h2>

      {/* Source */}
      <p className="text-sm text-stone-400 mb-4">
        {sender.replace(/<.*>/, "").trim()} · {date}
      </p>

      {/* Summary */}
      <p className="text-base text-stone-700 leading-relaxed mb-5">
        {summary}
      </p>

      {/* Takeaways */}
      {takeaways.length > 0 && (
        <div className="border-l-2 border-amber-300 pl-4 mb-5 space-y-2">
          {takeaways.map((point, i) => (
            <p key={i} className="text-sm text-stone-600 leading-relaxed">
              {point}
            </p>
          ))}
        </div>
      )}

      {/* Read full */}
      <button
        onClick={onReadFull}
        className="flex items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-950 transition-colors"
      >
        <FileText className="h-4 w-4" />
        Read full newsletter
      </button>
    </article>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/headline-card.tsx
git commit -m "feat: HeadlineCard component for gazette section 1"
```

---

### Task 10: UI — HookCard component

**Files:**
- Create: `src/components/hook-card.tsx`

**Step 1: Create `HookCard`**

Medium card for Section 2 with expand behavior.

```typescript
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, FileText } from "lucide-react";

interface HookCardProps {
  interestTag: string;
  hook: string;
  expandedSummary: string;
  takeaways: string[];
  sender: string;
  receivedAt: string;
  onReadFull: () => void;
}

export function HookCard({
  interestTag,
  hook,
  expandedSummary,
  takeaways,
  sender,
  receivedAt,
  onReadFull,
}: HookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <article
      onClick={() => setExpanded(!expanded)}
      className="bg-card rounded-xl p-5 shadow-sm shadow-amber-100/50 cursor-pointer active:shadow-md transition-shadow border border-stone-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Badge className="bg-stone-100 text-stone-600 text-[11px] font-medium border-0">
          {interestTag}
        </Badge>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-stone-300" />
        </motion.div>
      </div>

      {/* Source */}
      <p className="text-xs text-stone-400 mb-2">
        {sender.replace(/<.*>/, "").trim()} · {date}
      </p>

      {/* Hook */}
      <p className="text-[15px] font-medium text-stone-800 leading-snug">
        {hook}
      </p>

      {/* Expanded content */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <p className="text-sm text-stone-600 leading-relaxed mt-4">
            {expandedSummary}
          </p>

          {takeaways.length > 0 && (
            <div className="mt-3 border-l-2 border-amber-200 pl-3 space-y-1.5">
              {takeaways.map((point, i) => (
                <p key={i} className="text-sm text-stone-500">
                  {point}
                </p>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-stone-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReadFull();
              }}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Read full newsletter
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/hook-card.tsx
git commit -m "feat: HookCard component for gazette section 2"
```

---

### Task 11: UI — BriefItem component

**Files:**
- Create: `src/components/brief-item.tsx`

**Step 1: Create `BriefItem`**

Compact row for Section 3.

```typescript
"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

interface BriefItemProps {
  interestTag: string;
  oneLiner: string;
  expandedSummary: string;
  sender: string;
  onReadFull: () => void;
}

export function BriefItem({
  interestTag,
  oneLiner,
  expandedSummary,
  sender,
  onReadFull,
}: BriefItemProps) {
  const [expanded, setExpanded] = useState(false);
  const senderName = sender.replace(/<.*>/, "").trim();

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="px-4 py-3 cursor-pointer hover:bg-amber-50/50 transition-colors"
    >
      {/* Header line */}
      <p className="text-xs text-stone-400 mb-1">
        {senderName} · <span className="text-stone-300">{interestTag}</span>
      </p>

      {/* One-liner */}
      <p className="text-sm text-stone-700 leading-relaxed">{oneLiner}</p>

      {/* Expanded */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <p className="text-sm text-stone-500 leading-relaxed mt-2">
            {expandedSummary}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReadFull();
            }}
            className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-700 transition-colors mt-2"
          >
            <FileText className="h-3 w-3" />
            Read full
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/brief-item.tsx
git commit -m "feat: BriefItem component for gazette section 3"
```

---

### Task 12: UI — GazetteFooter component

**Files:**
- Create: `src/components/gazette-footer.tsx`

**Step 1: Create `GazetteFooter`**

```typescript
interface GazetteFooterProps {
  sourcesToday: number;
  libraryTotal: number;
  librarySurfaced: number;
}

export function GazetteFooter({
  sourcesToday,
  libraryTotal,
  librarySurfaced,
}: GazetteFooterProps) {
  return (
    <div className="text-center py-10 mt-8 border-t border-stone-100">
      <p className="text-base font-medium text-stone-700 mb-2">
        That's it for today.
      </p>
      <p className="text-sm text-stone-400">
        {sourcesToday} sources · {libraryTotal.toLocaleString()} in your library
        · {librarySurfaced} surfaced so far
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/gazette-footer.tsx
git commit -m "feat: GazetteFooter completion component"
```

---

### Task 13: UI — Rewrite gazette page with 3-tier layout

**Files:**
- Modify: `src/app/(app)/gazette/page.tsx`

**Step 1: Rewrite the gazette page**

Replace the flat card list with the 3-tier sectioned layout. Key changes:

- Remove SSE streaming logic (`EventSource`, `streamGazette`)
- `POST /api/gazette` now returns `{ editionId, status: "ready" }` directly (generation happens server-side)
- Fetch edition by ID, articles come grouped by section
- Render `HeadlineCard` for `headline` section
- Render `HookCard[]` for `worth_your_time` section
- Render `BriefItem[]` for `in_brief` section
- Add `GazetteFooter`
- Show loading state while gazette generates (polling or single wait)
- Keep `ArticleOverlay` for "Read full"
- Apply warmer background: `bg-gradient-to-b from-amber-50/30 to-stone-50`

The page should:
1. POST to `/api/gazette` → wait for response (may take 5-15s)
2. If `status: "ready"` → GET `/api/editions/{id}` → render gazette
3. Show warm loading animation during generation

**Step 2: Commit**

```bash
git add src/app/(app)/gazette/page.tsx
git commit -m "feat: 3-tier gazette layout with warm editorial theme"
```

---

### Task 14: Visual warmth pass

**Files:**
- Modify: `src/app/(app)/gazette/page.tsx`
- Modify: `src/components/headline-card.tsx`
- Modify: `src/components/hook-card.tsx`
- Modify: `src/components/brief-item.tsx`
- Modify: `src/components/gazette-footer.tsx`
- Modify: `src/components/gazette-header.tsx`
- Possibly: `src/app/globals.css` or Tailwind config

**Step 1: Warm theme adjustments**

- Page background: warm gradient (`from-amber-50/30 via-orange-50/10 to-stone-50`)
- Card backgrounds: subtle warm tints instead of pure white
- Headline card: gentle amber gradient, feels like morning sunlight
- Section headers ("Worth Your Time", "In Brief"): warm stone tones, generous spacing
- Footer: warm and conclusive, subtle separator
- Typography: ensure good hierarchy (headline card title significantly larger than hook card text)
- Interest tag chips: warm color palette (amber, orange, warm red tones)
- Loading state: warm animation (pulsing amber tones)

**Step 2: Commit**

```bash
git add -A
git commit -m "style: warm editorial theme across gazette components"
```

---

### Task 15: Cleanup and verify

**Files:**
- Delete: `src/app/api/gazette/[id]/stream/route.ts` (if not done in Task 6)
- Modify: `src/components/gazette-card.tsx` — keep for potential past edition display, or delete if unused
- Modify: `src/__tests__/newsletters.test.ts` — update `selectRandomNewsletters` test if function is removed

**Step 1: Run all tests**

Run: `npm run test`
Expected: All tests pass

**Step 2: Run dev server and verify**

Run: `npm run dev`
Manually test:
- Onboarding: label multi-select → interests picker → gazette
- Gazette generation with new pipeline
- 3-tier layout rendering
- Article overlay still works
- Past editions still accessible

**Step 3: Run lint**

Run: `npm run lint`
Fix any issues.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup old streaming code, verify gazette evolution"
```

---

## Summary

| Task | Description | Depends on |
|------|------------|------------|
| 1 | Schema: `userInterests` + `editionArticles` columns | — |
| 2 | Schema: `userPreferences` multi-label | — |
| 3 | API: interests CRUD | Task 1 |
| 4 | API: preferences multi-label | Task 2 |
| 5 | Gazette generator (Gemini editor call) | Task 1 |
| 6 | Rewrite gazette API route | Tasks 2, 4, 5 |
| 7 | Onboarding: multi-label picker | Task 4 |
| 8 | Onboarding: interest picker | Task 3 |
| 9 | UI: HeadlineCard | — |
| 10 | UI: HookCard | — |
| 11 | UI: BriefItem | — |
| 12 | UI: GazetteFooter | — |
| 13 | UI: Rewrite gazette page | Tasks 6, 9-12 |
| 14 | Visual warmth pass | Task 13 |
| 15 | Cleanup and verify | All |
