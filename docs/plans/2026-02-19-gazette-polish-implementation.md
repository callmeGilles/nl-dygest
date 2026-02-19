# Gazette Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve gazette generation speed to under 60s, apply a warm editorial theme, fix card expand animation stutter, and redesign the article overlay with summary-first hierarchy.

**Architecture:** Four independent improvements: (1) parallelize Gemini API calls in batches of 3 with a singleton client, (2) replace cold slate palette with warm stone/amber tokens across all components, (3) replace Framer Motion height animation with CSS grid transition, (4) restructure article overlay content hierarchy.

**Tech Stack:** Next.js App Router, Tailwind CSS 4 (oklch tokens), Framer Motion, Google GenAI, shadcn/ui

**Design doc:** `docs/plans/2026-02-19-gazette-polish-design.md`

---

### Task 1: Singleton GenAI Client

**Files:**
- Modify: `src/lib/summarize.ts:3,40`

**Step 1: Extract GenAI instantiation to module scope**

In `src/lib/summarize.ts`, move the client creation out of `summarizeNewsletter()`:

```typescript
// Line 3 area — after imports, add:
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
```

Then in `summarizeNewsletter()` (line 40), remove the local `const ai = ...` line. The function already references `ai` — it will now use the module-level singleton.

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/summarize.ts
git commit -m "perf: use singleton GenAI client"
```

---

### Task 2: Parallel Batched Gemini Calls

**Files:**
- Modify: `src/app/api/gazette/[id]/stream/route.ts`

**Step 1: Replace sequential loop with batched parallel processing**

Replace the entire `for` loop (lines 27-71) inside the `start(controller)` callback with:

```typescript
      // Process newsletters in batches of 3 for parallelism
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 500;
      let completed = 0;

      for (let batchStart = 0; batchStart < newsletterIds.length; batchStart += BATCH_SIZE) {
        const batch = newsletterIds.slice(batchStart, batchStart + BATCH_SIZE);

        // Add delay between batches (skip first)
        if (batchStart > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY));

        const results = await Promise.allSettled(
          batch.map(async (nlId) => {
            const newsletter = await db.query.newsletters.findFirst({
              where: eq(schema.newsletters.id, nlId),
            });
            if (!newsletter) return null;

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

            return {
              ...article,
              sender: newsletter.sender,
              rawHtml: newsletter.rawHtml,
              receivedAt: newsletter.receivedAt,
            };
          })
        );

        for (const result of results) {
          completed++;
          if (result.status === "fulfilled" && result.value) {
            send({
              type: "article",
              article: result.value,
              progress: { current: completed, total: newsletterIds.length },
            });
          } else {
            console.error(`Failed to summarize newsletter in batch:`, result.status === "rejected" ? result.reason : "not found");
            send({
              type: "error",
              progress: { current: completed, total: newsletterIds.length },
            });
          }
        }
      }
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Manual test — generate a gazette**

Clear data and trigger gazette generation. Observe SSE events arrive in batches rather than one-by-one. Total time should be noticeably faster.

**Step 4: Commit**

```bash
git add src/app/api/gazette/[id]/stream/route.ts
git commit -m "perf: parallelize Gemini calls in batches of 3"
```

---

### Task 3: Warm Theme Tokens

**Files:**
- Modify: `src/app/globals.css:50-82`

**Step 1: Update `:root` light theme tokens**

Replace these token values in the `:root` block:

| Variable | Old | New |
|----------|-----|-----|
| `--background` | `oklch(1 0 0)` | `oklch(0.97 0.006 83)` |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.16 0.012 55)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.995 0.003 83)` |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.16 0.012 55)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.995 0.003 83)` |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.16 0.012 55)` |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.95 0.006 83)` |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.55 0.01 55)` |
| `--border` | `oklch(0.922 0 0)` | `oklch(0.92 0.008 80)` |
| `--input` | `oklch(0.922 0 0)` | `oklch(0.92 0.008 80)` |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.7 0.01 55)` |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.95 0.006 83)` |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.95 0.006 83)` |

Leave `--primary`, `--primary-foreground`, `--destructive`, and `--chart-*` unchanged.

**Step 2: Verify dev server renders warm tones**

Run: `npm run dev`
Open `localhost:3000/gazette`. Background should appear warm cream instead of cool white.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: apply warm editorial theme tokens"
```

---

### Task 4: Gazette Page — Use Theme Tokens

**Files:**
- Modify: `src/app/(app)/gazette/page.tsx`

**Step 1: Replace hardcoded slate classes with theme-aware classes**

| Line | Old | New |
|------|-----|-----|
| 130 | `bg-slate-50` | `bg-background` |
| 136 | `text-slate-900` | `text-foreground` |
| 138 | `text-slate-400` | `text-muted-foreground` |
| 161 | `text-slate-500` | `text-muted-foreground` |
| 162 | `text-slate-400` | `text-muted-foreground` |

**Step 2: Visual check**

Verify the gazette page uses warm tones consistently from the theme tokens.

**Step 3: Commit**

```bash
git add src/app/(app)/gazette/page.tsx
git commit -m "style: gazette page uses theme tokens"
```

---

### Task 5: Gazette Header — Warm Colors

**Files:**
- Modify: `src/components/gazette-header.tsx`

**Step 1: Replace slate classes**

| Line | Old | New |
|------|-----|-----|
| 30 | `bg-white/80` | `bg-card/80` |
| 33 | `text-slate-900` | `text-foreground` |
| 39 | `text-slate-400 hover:text-slate-900` | `text-muted-foreground hover:text-foreground` |
| 46 | `text-slate-400` | `text-muted-foreground` |

**Step 2: Visual check**

Header should blend with the warm background.

**Step 3: Commit**

```bash
git add src/components/gazette-header.tsx
git commit -m "style: gazette header uses theme tokens"
```

---

### Task 6: Gazette Loading — Warm Colors

**Files:**
- Modify: `src/components/gazette-loading.tsx`

**Step 1: Replace slate classes**

| Line | Old | New |
|------|-----|-----|
| 16 | `text-slate-700` | `text-foreground` |
| 19 | `text-slate-400` | `text-muted-foreground` |

**Step 2: Commit**

```bash
git add src/components/gazette-loading.tsx
git commit -m "style: gazette loading uses theme tokens"
```

---

### Task 7: Gazette Card — Warm Theme + CSS Grid Animation

**Files:**
- Modify: `src/components/gazette-card.tsx`

**Step 1: Update category color map**

Replace the `categoryColors` object (lines 20-26):

```typescript
const categoryColors: Record<string, string> = {
  Tech: "bg-sky-50 text-sky-700",
  Product: "bg-violet-50 text-violet-700",
  Business: "bg-emerald-50 text-emerald-700",
  Design: "bg-rose-50 text-rose-700",
  Other: "bg-stone-100 text-stone-500",
};
```

**Step 2: Update card classes for warm theme**

| Location | Old | New |
|----------|-----|-----|
| Card wrapper (line 53) | `bg-white rounded-xl p-5 shadow-sm` | `bg-card rounded-xl p-5 shadow-sm shadow-stone-200/50` |
| Headline (line 64) | `text-slate-900` | `text-stone-900` |
| Summary (line 70) | `text-slate-500` | `text-stone-500` |
| Reading time (line 60) | `text-slate-400` | `text-stone-400` |
| Key points heading (line 90) | `text-slate-400` | `text-stone-400` |
| Key points text (line 95) | `text-slate-600` | `text-stone-600` |
| Bullet (line 96) | `text-slate-300` | `text-stone-300` |
| Border (line 105) | `border-slate-100` | `border-stone-200/60` |
| Read link (line 111) | `text-slate-500 hover:text-slate-900` | `text-stone-500 hover:text-stone-900` |
| Footer sender (line 123) | `text-slate-400` | `text-stone-400` |
| Chevron (line 130) | `text-slate-300` | `text-stone-300` |

**Step 3: Replace Framer Motion expand with CSS grid transition**

Remove `AnimatePresence` import (line 4). Keep `motion` for the chevron.

Replace the `layout` prop on `motion.article` (line 50-53) — change `motion.article` to plain `article`:

```tsx
    <article
      onClick={() => setExpanded(!expanded)}
      className="bg-card rounded-xl p-5 shadow-sm shadow-stone-200/50 cursor-pointer active:shadow-md transition-shadow"
    >
```

Replace the `<AnimatePresence>...</AnimatePresence>` block (lines 78-118) with:

```tsx
      {/* Expanded content — CSS grid transition */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          {/* Key points */}
          {keyPoints.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Key Points
              </h4>
              <ul className="space-y-1.5">
                {keyPoints.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm text-stone-600">
                    <span className="text-stone-300 shrink-0">&bull;</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Read original link */}
          <div className="mt-4 pt-3 border-t border-stone-200/60">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReadOriginal(article);
              }}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Read original newsletter
            </button>
          </div>
        </div>
      </div>
```

Update the closing tag from `</motion.article>` to `</article>`.

Update import line — remove `AnimatePresence`:

```typescript
import { motion } from "framer-motion";
```

**Step 4: Visual test**

Click a card — expand/collapse should be smooth with no stutter. No layout jump.

**Step 5: Commit**

```bash
git add src/components/gazette-card.tsx
git commit -m "style: warm theme + CSS grid expand animation for gazette card"
```

---

### Task 8: Article Overlay — Summary-First + Warm Theme

**Files:**
- Modify: `src/components/article-overlay.tsx`

**Step 1: Update category color map**

Replace `categoryColors` (lines 21-27):

```typescript
const categoryColors: Record<string, string> = {
  Tech: "bg-sky-100 text-sky-700",
  Product: "bg-violet-100 text-violet-700",
  Business: "bg-emerald-100 text-emerald-700",
  Design: "bg-rose-100 text-rose-700",
  Other: "bg-stone-100 text-stone-600",
};
```

**Step 2: Add icons import**

Update the lucide-react import (line 7):

```typescript
import { X, User, Calendar, Clock } from "lucide-react";
```

**Step 3: Replace overlay panel content**

Replace the entire `<div className="p-6 md:p-8 space-y-6">` block (lines 88-148) with:

```tsx
            <div className="p-6 md:p-8 space-y-6">
              {/* Close button */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full text-stone-400 hover:text-stone-900"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Category + Headline */}
              <div className="space-y-3">
                <Badge className={`${colorClass} text-xs font-medium`}>
                  {article.category}
                </Badge>
                <h1 className="text-2xl md:text-3xl font-bold text-stone-900 leading-tight">
                  {article.headline}
                </h1>
              </div>

              {/* Summary — hero section */}
              <div className="bg-stone-50 rounded-lg p-4 space-y-1">
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Summary
                </h2>
                <p className="text-base text-stone-800 leading-relaxed">
                  {article.summary}
                </p>
              </div>

              {/* Metadata bar */}
              <div className="flex items-center gap-4 bg-stone-50/50 rounded-lg px-4 py-3 text-sm text-stone-500">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {article.sender.replace(/<.*>/, "").trim()}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {article.readingTime} min read
                </span>
              </div>

              {/* Key points */}
              {keyPoints.length > 0 && (
                <div className="border-l-2 border-amber-300 pl-4 space-y-2">
                  <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    Key Points
                  </h2>
                  <ul className="space-y-2">
                    {keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm text-stone-600">
                        <span className="text-stone-300 mt-0.5">&bull;</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-stone-200/60" />

              {/* Full newsletter */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Full Newsletter
                </h2>
                <div
                  className="prose prose-stone prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: article.rawHtml }}
                />
              </div>
            </div>
```

**Step 4: Update panel background**

On line 86, change `bg-white` to `bg-card`:

```tsx
className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card z-50 shadow-2xl overflow-y-auto"
```

**Step 5: Visual test**

Open an article. Verify:
- Summary appears as a distinct card with warm background
- Metadata bar is compact with icons
- Key points have amber left border
- All colors are warm stone tones

**Step 6: Commit**

```bash
git add src/components/article-overlay.tsx
git commit -m "style: summary-first overlay layout with warm editorial theme"
```

---

### Task 9: Final Verification

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors (or only pre-existing warnings)

**Step 3: Run tests**

Run: `npm run test`
Expected: All pass

**Step 4: Full manual test**

1. Clear DB data: `sqlite3 briefflow.db "DELETE FROM edition_articles; DELETE FROM triage_decisions; DELETE FROM reading_sessions; DELETE FROM editions; DELETE FROM newsletters;"`
2. Open app, trigger gazette generation
3. Verify generation completes in under 60s
4. Verify warm cream background, warm card colors
5. Click a card — expand should be smooth, no stutter
6. Click "Read original" — overlay should show summary-first with metadata bar and key points
7. Check header blends with warm background

**Step 5: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: polish fixups from manual testing"
```
