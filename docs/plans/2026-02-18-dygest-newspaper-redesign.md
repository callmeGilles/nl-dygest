# Dygest Newspaper Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the sidebar + reading pane dygest layout with an Airbnb-styled newspaper grid where clicking an article opens a slide-in overlay.

**Architecture:** Rewrite `read/[id]/page.tsx` as a responsive CSS Grid. Extract two new components: `NewspaperCard` (hero + standard variants) and `ArticleOverlay` (slide-in panel). Remove `article-list.tsx` and `reading-pane.tsx`. No API changes.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui (Badge, Button, Skeleton), framer-motion (overlay animation)

---

### Task 1: Create NewspaperCard component

**Files:**
- Create: `src/components/newspaper-card.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";

interface Article {
  id: number;
  headline: string;
  summary: string;
  readingTime: number;
  sender: string;
  category: string;
}

const categoryColors: Record<string, string> = {
  Tech: "bg-blue-100 text-blue-700",
  Product: "bg-purple-100 text-purple-700",
  Business: "bg-green-100 text-green-700",
  Design: "bg-pink-100 text-pink-700",
  Other: "bg-slate-100 text-slate-600",
};

interface NewspaperCardProps {
  article: Article;
  variant: "hero" | "standard";
  onClick: () => void;
}

export function NewspaperCard({ article, variant, onClick }: NewspaperCardProps) {
  const colorClass = categoryColors[article.category] || categoryColors.Other;

  if (variant === "hero") {
    return (
      <article
        onClick={onClick}
        className="col-span-full bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
      >
        <Badge className={`${colorClass} text-xs font-medium mb-3`}>
          {article.category}
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight mb-3">
          {article.headline}
        </h2>
        <p className="text-base text-slate-600 leading-relaxed mb-4 max-w-2xl">
          {article.summary}
        </p>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{article.sender}</span>
          <span>&middot;</span>
          <span>{article.readingTime} min read</span>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={onClick}
      className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
    >
      <Badge className={`${colorClass} text-xs font-medium mb-3`}>
        {article.category}
      </Badge>
      <h3 className="text-lg font-semibold text-slate-900 leading-snug mb-2">
        {article.headline}
      </h3>
      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4">
        {article.summary}
      </p>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="truncate">{article.sender}</span>
        <span>&middot;</span>
        <span>{article.readingTime} min</span>
      </div>
    </article>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/newspaper-card.tsx
git commit -m "feat: add NewspaperCard component with hero and standard variants"
```

---

### Task 2: Create ArticleOverlay component

**Files:**
- Create: `src/components/article-overlay.tsx`

**Step 1: Create the component**

Uses framer-motion (already in dependencies) for smooth slide-in animation. Shows category, headline, sender, date, reading time, summary, key points, and full newsletter HTML.

```tsx
"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
  Tech: "bg-blue-100 text-blue-700",
  Product: "bg-purple-100 text-purple-700",
  Business: "bg-green-100 text-green-700",
  Design: "bg-pink-100 text-pink-700",
  Other: "bg-slate-100 text-slate-600",
};

interface ArticleOverlayProps {
  article: Article | null;
  onClose: () => void;
}

export function ArticleOverlay({ article, onClose }: ArticleOverlayProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (article) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [article]);

  let keyPoints: string[] = [];
  if (article) {
    try { keyPoints = JSON.parse(article.keyPoints); } catch { keyPoints = []; }
  }

  const date = article
    ? new Date(article.receivedAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  const colorClass = article
    ? categoryColors[article.category] || categoryColors.Other
    : "";

  return (
    <AnimatePresence>
      {article && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 shadow-2xl overflow-y-auto"
          >
            <div className="p-6 md:p-8 space-y-6">
              {/* Close button */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full text-slate-400 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Header */}
              <div className="space-y-3">
                <Badge className={`${colorClass} text-xs font-medium`}>
                  {article.category}
                </Badge>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                  {article.headline}
                </h1>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>{article.sender}</span>
                  <span>&middot;</span>
                  <span>{date}</span>
                  <span>&middot;</span>
                  <span>{article.readingTime} min read</span>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-slate-100" />

              {/* Summary */}
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Summary
                </h2>
                <p className="text-base text-slate-700 leading-relaxed">
                  {article.summary}
                </p>
              </div>

              {/* Key Points */}
              {keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Key Points
                  </h2>
                  <ul className="space-y-2">
                    {keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-600">
                        <span className="text-slate-300 mt-0.5">&bull;</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Separator */}
              <div className="border-t border-slate-100" />

              {/* Full newsletter content */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Full Newsletter
                </h2>
                <div
                  className="prose prose-slate prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: article.rawHtml }}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/article-overlay.tsx
git commit -m "feat: add ArticleOverlay slide-in panel component"
```

---

### Task 3: Rewrite the read/[id] page as newspaper grid

**Files:**
- Modify: `src/app/(app)/read/[id]/page.tsx` (full rewrite)

**Step 1: Rewrite the page**

Replace entire content of `src/app/(app)/read/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NewspaperCard } from "@/components/newspaper-card";
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
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Flatten grouped articles into a single list
  const allArticles = Object.values(data.articles).flat();
  const heroArticle = allArticles[0];
  const gridArticles = allArticles.slice(1);

  const date = new Date(data.edition.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        {/* Edition header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Your Briefflow</h1>
          <p className="text-sm text-slate-400 mt-1">
            {date} &middot; {allArticles.length} articles
          </p>
        </div>

        {/* Newspaper grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Hero article — full width */}
          {heroArticle && (
            <NewspaperCard
              article={heroArticle}
              variant="hero"
              onClick={() => setSelectedArticle(heroArticle)}
            />
          )}

          {/* Remaining articles */}
          {gridArticles.map((article) => (
            <NewspaperCard
              key={article.id}
              article={article}
              variant="standard"
              onClick={() => setSelectedArticle(article)}
            />
          ))}
        </div>
      </div>

      {/* Article overlay */}
      <ArticleOverlay
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/read/[id]/page.tsx
git commit -m "feat: rewrite dygest page as newspaper grid with overlay"
```

---

### Task 4: Remove old components

**Files:**
- Delete: `src/components/article-list.tsx`
- Delete: `src/components/reading-pane.tsx`

**Step 1: Verify no other imports**

Search for any remaining imports of `article-list` or `reading-pane` in the codebase. After Task 3, the only consumer (`read/[id]/page.tsx`) no longer imports them.

**Step 2: Delete files and commit**

```bash
rm src/components/article-list.tsx src/components/reading-pane.tsx
git add -u src/components/article-list.tsx src/components/reading-pane.tsx
git commit -m "chore: remove old article-list and reading-pane components"
```

---

### Task 5: Verify and visual check

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Navigate to the dygest page**

- Go to `/read/[latest-edition-id]`
- Verify: newspaper grid renders with hero card + grid cards
- Verify: clicking a card opens the slide-in overlay
- Verify: Escape key and backdrop click close the overlay
- Verify: mobile layout stacks to single column
- Verify: no console errors

**Step 3: Run linter**

```bash
npm run lint
```

**Step 4: Final commit if any fixes needed**
