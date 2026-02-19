# Gazette Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the triage-based flow with an auto-generated daily gazette — a calm, scannable feed of 5-10 randomly selected newsletters with inline-expandable article cards and SSE progressive loading.

**Architecture:** The gazette auto-selects random unread newsletters from Gmail, summarizes them via Gemini, stores as an edition in SQLite, and streams articles to the client via SSE. One gazette per day, cached in DB. No triage, no navbar — the gazette is the entire app experience.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Framer Motion, Drizzle ORM (SQLite), Google Gemini, Server-Sent Events.

**Design doc:** `docs/plans/2026-02-19-gazette-redesign-design.md`

---

### Task 1: Add random newsletter selection utility

**Files:**
- Modify: `src/lib/newsletters.ts`
- Create: `src/__tests__/newsletters.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/newsletters.test.ts
import { describe, it, expect } from "vitest";
import { selectRandomNewsletters } from "@/lib/newsletters";

describe("selectRandomNewsletters", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    gmailId: `msg-${i}`,
    sender: `sender-${i}`,
    subject: `subject-${i}`,
    snippet: "",
    receivedAt: new Date().toISOString(),
    rawHtml: "<p>content</p>",
  }));

  it("returns between min and max items", () => {
    const result = selectRandomNewsletters(items, 5, 10);
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns all items if fewer than min available", () => {
    const few = items.slice(0, 3);
    const result = selectRandomNewsletters(few, 5, 10);
    expect(result).toHaveLength(3);
  });

  it("returns items from the input array", () => {
    const result = selectRandomNewsletters(items, 5, 10);
    for (const item of result) {
      expect(items).toContainEqual(item);
    }
  });

  it("returns no duplicates", () => {
    const result = selectRandomNewsletters(items, 10, 10);
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/newsletters.test.ts`
Expected: FAIL — `selectRandomNewsletters` is not exported

**Step 3: Write minimal implementation**

Add to `src/lib/newsletters.ts`:

```typescript
export function selectRandomNewsletters<T>(
  items: T[],
  min: number,
  max: number
): T[] {
  if (items.length <= min) return [...items];
  const count = Math.min(
    items.length,
    Math.floor(Math.random() * (max - min + 1)) + min
  );
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/newsletters.test.ts`
Expected: PASS — all 4 tests green

**Step 5: Commit**

```bash
git add src/lib/newsletters.ts src/__tests__/newsletters.test.ts
git commit -m "feat: add random newsletter selection utility"
```

---

### Task 2: Create gazette generation API (`POST /api/gazette`)

**Files:**
- Create: `src/app/api/gazette/route.ts`

**Context:** This endpoint checks if a gazette (edition) already exists for today. If yes, returns it. If no, fetches unread newsletters from Gmail, picks 5-10 randomly, creates an edition row, and returns the edition ID + newsletter IDs for streaming.

**Step 1: Create the API route**

```typescript
// src/app/api/gazette/route.ts
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, notInArray } from "drizzle-orm";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { fetchNewsletters, selectRandomNewsletters } from "@/lib/newsletters";

export async function POST() {
  try {
    const auth = await getAuthenticatedSession();
    if (!auth?.tokens) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if gazette already exists for today
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
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

    // Fetch unread newsletters from Gmail
    const label = auth.preferences?.gmailLabel || "Newsletters";
    const gmailNewsletters = await fetchNewsletters(
      label,
      50, // fetch more to have a good pool
      auth.tokens.accessToken,
      auth.tokens.refreshToken
    );

    // Store new newsletters in DB
    for (const nl of gmailNewsletters) {
      const existing = await db.query.newsletters.findFirst({
        where: (newsletters, { eq }) => eq(newsletters.gmailId, nl.gmailId),
      });
      if (!existing) {
        await db.insert(schema.newsletters).values(nl);
      }
    }

    // Get all newsletters not yet in any edition
    const existingArticles = await db.query.editionArticles.findMany();
    const processedNlIds = new Set(existingArticles.map((a) => a.newsletterId));

    const allNewsletters = await db.query.newsletters.findMany();
    const available = allNewsletters.filter((nl) => !processedNlIds.has(nl.id));

    if (available.length === 0) {
      return NextResponse.json(
        { error: "No unread newsletters available" },
        { status: 400 }
      );
    }

    // Pick 5-10 random newsletters
    const selected = selectRandomNewsletters(available, 5, 10);

    // Create edition
    const [edition] = await db
      .insert(schema.editions)
      .values({ generatedAt: new Date().toISOString() })
      .returning();

    return NextResponse.json({
      editionId: edition.id,
      status: "generating",
      total: selected.length,
      newsletterIds: selected.map((nl) => nl.id),
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

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/gazette/route.ts
git commit -m "feat: add gazette generation API endpoint"
```

---

### Task 3: Create SSE streaming API (`GET /api/gazette/[id]/stream`)

**Files:**
- Create: `src/app/api/gazette/[id]/stream/route.ts`

**Context:** This endpoint takes an edition ID and a list of newsletter IDs. For each newsletter, it summarizes via Gemini, inserts into `editionArticles`, and streams the result as an SSE event.

**Step 1: Create the SSE route**

```typescript
// src/app/api/gazette/[id]/stream/route.ts
import { NextRequest } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { summarizeNewsletter } from "@/lib/summarize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const editionId = parseInt(id);

  // Get newsletter IDs from query params
  const newsletterIdsParam = request.nextUrl.searchParams.get("newsletterIds");
  if (!newsletterIdsParam) {
    return new Response("Missing newsletterIds", { status: 400 });
  }
  const newsletterIds = newsletterIdsParam.split(",").map(Number);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      for (let i = 0; i < newsletterIds.length; i++) {
        const nlId = newsletterIds[i];
        try {
          const newsletter = await db.query.newsletters.findFirst({
            where: eq(schema.newsletters.id, nlId),
          });

          if (!newsletter) continue;

          // Add delay between API calls for rate limiting (skip first)
          if (i > 0) await new Promise((r) => setTimeout(r, 2000));

          const summary = await summarizeNewsletter(newsletter.rawHtml);

          const [article] = await db
            .insert(schema.editionArticles)
            .values({
              editionId,
              newsletterId: newsletter.id,
              category: summary.category,
              headline: summary.headline,
              summary: summary.summary,
              keyPoints: JSON.stringify(summary.key_points),
              readingTime: summary.reading_time,
            })
            .returning();

          send({
            type: "article",
            article: {
              ...article,
              sender: newsletter.sender,
              rawHtml: newsletter.rawHtml,
              receivedAt: newsletter.receivedAt,
            },
            progress: { current: i + 1, total: newsletterIds.length },
          });
        } catch (err) {
          console.error(`Failed to summarize newsletter ${nlId}:`, err);
          send({
            type: "error",
            newsletterId: nlId,
            progress: { current: i + 1, total: newsletterIds.length },
          });
        }
      }

      send({ type: "complete" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/gazette/[id]/stream/route.ts
git commit -m "feat: add SSE streaming endpoint for gazette article generation"
```

---

### Task 4: Create gazette header component

**Files:**
- Create: `src/components/gazette-header.tsx`

**Context:** Minimal header — "Briefflow" logotype on left, gear icon on right with dropdown (past gazettes, sign out). Fixed top, transparent with backdrop blur.

**Step 1: Create the component**

```tsx
// src/components/gazette-header.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Edition {
  id: number;
  generatedAt: string;
}

interface GazetteHeaderProps {
  pastEditions?: Edition[];
}

export function GazetteHeader({ pastEditions = [] }: GazetteHeaderProps) {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-sm">
      <Link
        href="/gazette"
        className="font-semibold text-base text-slate-900 tracking-tight"
      >
        briefflow
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-900">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {pastEditions.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-slate-400">
                Past gazettes
              </div>
              {pastEditions.slice(0, 7).map((edition) => (
                <DropdownMenuItem key={edition.id} asChild>
                  <Link href={`/gazette/${edition.id}`}>
                    {new Date(edition.generatedAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={handleLogout} className="text-red-600">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors. Note: shadcn dropdown-menu may need to be installed. If not present, run `npx shadcn@latest add dropdown-menu`.

**Step 3: Commit**

```bash
git add src/components/gazette-header.tsx
git commit -m "feat: add minimal gazette header with settings dropdown"
```

---

### Task 5: Create expandable gazette card component

**Files:**
- Create: `src/components/gazette-card.tsx`

**Context:** The core UI element. A card that shows collapsed summary and expands inline on tap to reveal full summary, key points, and a "Read original" link. Uses framer-motion for smooth layout animation.

**Step 1: Create the component**

```tsx
// src/components/gazette-card.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, FileText } from "lucide-react";

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

const categoryColors: Record<string, string> = {
  Tech: "bg-blue-50 text-blue-600",
  Product: "bg-purple-50 text-purple-600",
  Business: "bg-green-50 text-green-600",
  Design: "bg-pink-50 text-pink-600",
  Other: "bg-slate-50 text-slate-500",
};

interface GazetteCardProps {
  article: Article;
  onReadOriginal: (article: Article) => void;
}

export function GazetteCard({ article, onReadOriginal }: GazetteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = categoryColors[article.category] || categoryColors.Other;

  let keyPoints: string[] = [];
  try {
    keyPoints = JSON.parse(article.keyPoints);
  } catch {
    keyPoints = [];
  }

  const date = new Date(article.receivedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <motion.article
      layout
      onClick={() => setExpanded(!expanded)}
      className="bg-white rounded-xl p-5 shadow-sm cursor-pointer active:shadow-md transition-shadow"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <Badge className={`${colorClass} text-[11px] font-medium border-0`}>
          {article.category}
        </Badge>
        <span className="text-xs text-slate-400">{article.readingTime} min</span>
      </div>

      {/* Headline */}
      <h3 className="text-[17px] font-semibold text-slate-900 leading-snug mb-2">
        {article.headline}
      </h3>

      {/* Summary — truncated when collapsed, full when expanded */}
      <p
        className={`text-sm text-slate-500 leading-relaxed ${
          !expanded ? "line-clamp-2" : ""
        }`}
      >
        {article.summary}
      </p>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {/* Key points */}
            {keyPoints.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Key Points
                </h4>
                <ul className="space-y-1.5">
                  {keyPoints.map((point, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <span className="text-slate-300 shrink-0">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Read original link */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReadOriginal(article);
                }}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Read original newsletter
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-400 truncate">
          {article.sender.replace(/<.*>/, "").trim()} · {date}
        </span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
        </motion.div>
      </div>
    </motion.article>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/gazette-card.tsx
git commit -m "feat: add expandable gazette card with inline key points"
```

---

### Task 6: Create gazette loading component

**Files:**
- Create: `src/components/gazette-loading.tsx`

**Context:** Shows during gazette generation. Displays a progress bar and "Preparing your gazette" message. Articles fade in below as they arrive.

**Step 1: Create the component**

```tsx
// src/components/gazette-loading.tsx
"use client";

import { Progress } from "@/components/ui/progress";

interface GazetteLoadingProps {
  current: number;
  total: number;
}

export function GazetteLoading({ current, total }: GazetteLoadingProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="text-center space-y-4 py-8">
      <div className="text-2xl">☀️</div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700">
          Preparing your gazette
        </p>
        <p className="text-xs text-slate-400">
          {current} of {total} articles ready
        </p>
      </div>
      <div className="max-w-48 mx-auto">
        <Progress value={percentage} className="h-1" />
      </div>
    </div>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/gazette-loading.tsx
git commit -m "feat: add gazette loading progress component"
```

---

### Task 7: Create the gazette page

**Files:**
- Create: `src/app/(app)/gazette/page.tsx`

**Context:** The main app view. On mount, calls `POST /api/gazette`. If status is "ready", fetches articles from `GET /api/editions/[id]`. If "generating", connects to SSE stream and progressively displays articles. Also shows the date banner and past editions for the header.

**Step 1: Create the page**

```tsx
// src/app/(app)/gazette/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { GazetteHeader } from "@/components/gazette-header";
import { GazetteCard } from "@/components/gazette-card";
import { GazetteLoading } from "@/components/gazette-loading";
import { ArticleOverlay } from "@/components/article-overlay";
import { Skeleton } from "@/components/ui/skeleton";

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

interface Edition {
  id: number;
  generatedAt: string;
}

export default function GazettePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const loadReadyGazette = useCallback(async (editionId: number) => {
    const res = await fetch(`/api/editions/${editionId}`);
    const data = await res.json();
    const allArticles = Object.values(data.articles as Record<string, Article[]>).flat();
    setArticles(allArticles);
    setLoading(false);
  }, []);

  const streamGazette = useCallback(
    (editionId: number, newsletterIds: number[], total: number) => {
      setGenerating(true);
      setProgress({ current: 0, total });
      setLoading(false);

      const eventSource = new EventSource(
        `/api/gazette/${editionId}/stream?newsletterIds=${newsletterIds.join(",")}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "article") {
          setArticles((prev) => [...prev, data.article]);
          setProgress(data.progress);
        }

        if (data.type === "complete") {
          setGenerating(false);
          eventSource.close();
        }

        if (data.type === "error") {
          setProgress(data.progress);
        }
      };

      eventSource.onerror = () => {
        setGenerating(false);
        eventSource.close();
      };
    },
    []
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Fetch past editions for header
    fetch("/api/editions")
      .then((r) => r.json())
      .then((data) => setEditions(Array.isArray(data) ? data : []));

    // Generate or load today's gazette
    fetch("/api/gazette", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        if (data.status === "ready") {
          loadReadyGazette(data.editionId);
        } else if (data.status === "generating") {
          streamGazette(data.editionId, data.newsletterIds, data.total);
        }
      })
      .catch(() => {
        setError("Failed to load gazette");
        setLoading(false);
      });
  }, [loadReadyGazette, streamGazette]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <GazetteHeader pastEditions={editions} />

      <div className="max-w-xl mx-auto px-4 pb-12">
        {/* Date banner */}
        <div className="text-center py-8">
          <h1 className="text-xl font-semibold text-slate-900">{today}</h1>
          {articles.length > 0 && (
            <p className="text-sm text-slate-400 mt-1">
              {articles.length} article{articles.length !== 1 ? "s" : ""} from
              your newsletters
            </p>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Generation progress */}
        {generating && <GazetteLoading {...progress} />}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500">{error}</p>
            <p className="text-xs text-slate-400 mt-1">
              Check back later when new newsletters arrive.
            </p>
          </div>
        )}

        {/* Article cards */}
        <div className="space-y-3">
          {articles.map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: generating ? 0 : i * 0.05 }}
            >
              <GazetteCard
                article={article}
                onReadOriginal={setSelectedArticle}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Article overlay for "Read original" */}
      <ArticleOverlay
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/(app)/gazette/page.tsx
git commit -m "feat: add gazette page with SSE progressive loading"
```

---

### Task 8: Create gazette by ID page (past gazettes)

**Files:**
- Create: `src/app/(app)/gazette/[id]/page.tsx`

**Context:** Simple page that loads a specific gazette by ID from the existing `GET /api/editions/[id]` endpoint. Reuses the same card components.

**Step 1: Create the page**

```tsx
// src/app/(app)/gazette/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { GazetteHeader } from "@/components/gazette-header";
import { GazetteCard } from "@/components/gazette-card";
import { ArticleOverlay } from "@/components/article-overlay";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function GazetteByIdPage() {
  const params = useParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    fetch(`/api/editions/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        const allArticles = Object.values(
          data.articles as Record<string, Article[]>
        ).flat();
        setArticles(allArticles);
        setDate(
          new Date(data.edition.generatedAt).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        );
        setLoading(false);
      });
  }, [params.id]);

  return (
    <div className="min-h-screen bg-slate-50">
      <GazetteHeader />

      <div className="max-w-xl mx-auto px-4 pb-12">
        <div className="text-center py-8">
          <h1 className="text-xl font-semibold text-slate-900">{date}</h1>
          {articles.length > 0 && (
            <p className="text-sm text-slate-400 mt-1">
              {articles.length} article{articles.length !== 1 ? "s" : ""} from
              your newsletters
            </p>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        )}

        <div className="space-y-3">
          {articles.map((article, i) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <GazetteCard
                article={article}
                onReadOriginal={setSelectedArticle}
              />
            </motion.div>
          ))}
        </div>
      </div>

      <ArticleOverlay
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/(app)/gazette/[id]/page.tsx
git commit -m "feat: add past gazette view by ID"
```

---

### Task 9: Update app layout — remove NavBar

**Files:**
- Modify: `src/app/(app)/layout.tsx`

**Context:** The gazette has its own header. Remove the NavBar from the app layout since each gazette page renders `GazetteHeader` directly.

**Step 1: Update the layout**

Replace the contents of `src/app/(app)/layout.tsx` with:

```tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "refactor: remove NavBar from app layout"
```

---

### Task 10: Update landing page redirect and onboarding

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/label-picker.tsx`

**Context:**
1. Landing page: change redirect from `/read` to `/gazette`
2. Label picker: change redirect from `/triage` to `/gazette`, update stepper steps

**Step 1: Update landing page redirect**

In `src/app/page.tsx`, change line 12 from:
```tsx
redirect("/read");
```
to:
```tsx
redirect("/gazette");
```

Also update the tagline on line 28-29 from the triage-focused copy to gazette-focused:
```tsx
<p className="text-sm text-slate-600 max-w-xs mx-auto">
  Your daily newsletter digest, curated and summarized. Zero effort.
</p>
```

**Step 2: Update label picker redirect**

In `src/components/label-picker.tsx`, change line 45 from:
```tsx
router.push("/triage");
```
to:
```tsx
router.push("/gazette");
```

Also update the stepper on line 50 from:
```tsx
<OnboardingStepper currentStep={1} steps={["Connect", "Select", "Triage"]} />
```
to:
```tsx
<OnboardingStepper currentStep={1} steps={["Connect", "Select", "Read"]} />
```

**Step 3: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/label-picker.tsx
git commit -m "refactor: update redirects from triage/read to gazette"
```

---

### Task 11: Update middleware for gazette routes

**Files:**
- Modify: `src/middleware.ts`

**No changes needed.** The middleware already allows all authenticated routes through. The `/gazette` route is under `(app)/` which requires the session cookie — this is already handled. No middleware changes required.

**Step 1: Verify by reading middleware**

Confirm the existing middleware logic: it blocks unauthenticated access to all non-public paths. `/gazette` will be protected automatically.

**Step 2: Commit (skip — no changes)**

---

### Task 12: Remove triage page, old read pages, stats, and triage API

**Files:**
- Delete: `src/app/(app)/triage/page.tsx`
- Delete: `src/app/(app)/read/[id]/page.tsx`
- Delete: `src/app/(app)/read/` (entire directory if it has an index)
- Delete: `src/app/(app)/stats/page.tsx`
- Delete: `src/app/api/newsletters/triage/route.ts`
- Delete: `src/components/triage-card.tsx`
- Delete: `src/components/nav-bar.tsx`
- Delete: `src/components/newspaper-card.tsx`

**Step 1: Delete files**

```bash
rm -rf src/app/\(app\)/triage
rm -rf src/app/\(app\)/read
rm -rf src/app/\(app\)/stats
rm -rf src/app/api/newsletters/triage
rm src/components/triage-card.tsx
rm src/components/nav-bar.tsx
rm src/components/newspaper-card.tsx
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors. If there are import errors, fix any remaining references.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove triage flow, old read pages, stats, and navbar"
```

---

### Task 13: Mark onboarding complete on first gazette view

**Files:**
- Modify: `src/app/(app)/gazette/page.tsx`

**Context:** After the first gazette is generated, mark onboarding as complete (if not already). This replaces the old logic that marked it after triage.

**Step 1: Add onboarding completion**

In the gazette page's `useEffect`, after a gazette is successfully loaded or fully generated, call:

```typescript
// After gazette loads successfully (in the POST handler)
fetch("/api/preferences", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ onboardingCompleted: true }),
});
```

Add this call in two places:
1. After `loadReadyGazette` completes (status "ready")
2. After the SSE stream sends `type: "complete"`

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/(app)/gazette/page.tsx
git commit -m "feat: mark onboarding complete on first gazette view"
```

---

### Task 14: Install dropdown-menu shadcn component (if needed)

**Files:**
- Potentially creates files in `src/components/ui/`

**Step 1: Check if dropdown-menu exists**

```bash
ls src/components/ui/dropdown-menu.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Step 2: Install if missing**

```bash
npx shadcn@latest add dropdown-menu
```

**Step 3: Commit if installed**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "chore: add shadcn dropdown-menu component"
```

---

### Task 15: End-to-end manual verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test the flows**

1. Visit `http://localhost:3000` — should show landing page
2. Sign in with Google — should go to onboarding label picker
3. Select label → click Continue — should redirect to `/gazette`
4. Gazette should auto-generate with progress indicator
5. Articles should appear one by one
6. Tap a card — should expand inline with key points
7. Tap "Read original" — should open ArticleOverlay with full HTML
8. Click gear icon — should show past gazettes dropdown + sign out
9. Reload page — should show cached gazette instantly (no regeneration)

**Step 3: Test past gazette**

1. Click a past gazette from the dropdown
2. Should load that gazette's articles

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
