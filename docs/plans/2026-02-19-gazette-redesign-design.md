# Gazette Redesign Design

**Date:** 2026-02-19
**Status:** Approved

## Overview

Replace the triage-based flow (swipe to keep/skip → generate edition) with an automatic **Gazette** — a once-daily, auto-generated digest of 5-10 random unread newsletters. The user opens the app and a calm, scannable reading experience is ready or generating progressively.

**Mental model:** The app is a single-page gazette. Open it → read what catches you → done. Come back tomorrow for a new one.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vibe | Calm daily digest (Artifact-like) | Minimal, scannable, no visual noise |
| Newsletter selection | Fully random (5-10) | Pure serendipity, no bias logic |
| Reading interaction | Inline card expand | Stays in context, no navigation, mobile-friendly |
| Platform | Mobile-first web app | Next.js + PWA-ready, phone-first experience |
| Refresh model | One gazette per day | Habit-forming, no decision fatigue |
| Onboarding | OAuth → Label picker → First gazette | Minimal steps, no triage |
| Navigation | No navbar | Gazette IS the app. Gear icon for settings/past gazettes |
| Architecture | On-demand generation with DB caching | Generate on first open, cache, progressive loading via SSE |

## Core Flow

### Daily Gazette Flow
1. User opens `/gazette`
2. Check if edition exists for today (by `generatedAt` date)
3. If yes → load from DB → display instantly
4. If no → fetch unread newsletters from Gmail → pick 5-10 randomly → create edition → summarize via Gemini with SSE streaming → display articles progressively

### Onboarding Flow
1. OAuth sign-in (Google)
2. Label picker (select Gmail label containing newsletters)
3. First gazette auto-generates

## UI Design

### Header (minimal, fixed)
- **Left:** "Briefflow" logotype (text only, understated)
- **Right:** Gear icon (settings dropdown: past gazettes, sign out)
- Transparent background with blur on scroll, no border

### Date Banner
- Centered: **"Thursday, February 19"** (calm, elegant typography)
- Subtitle: "7 articles from your newsletters" (muted)
- Sets the daily ritual tone — the only "hero" element

### Article Cards (vertical stack, single column)

**Collapsed state:**
- Category badge (muted colored pill) + reading time (right-aligned)
- Headline (bold, medium — the star)
- Summary (1-2 lines, truncated, muted)
- Source + date (bottom, small, muted)
- White card, rounded corners, minimal shadow
- Tap anywhere to expand

**Expanded state (inline):**
- Same card, smoothly grown (framer-motion layout animation)
- Full summary (no truncation)
- Key points as clean bulleted list
- "Read original newsletter" link → opens ArticleOverlay with raw HTML
- Tap header or collapse button to close

### Progressive Loading State
- While generating: "Preparing your gazette" with progress bar (3 of 7)
- Articles fade in one by one as summarized
- Loading state is part of the gazette view (not a separate page)

### Visual Style
- **Background:** Off-white / warm gray (slate-50)
- **Cards:** White, subtle shadow
- **Typography:** System font stack, clean hierarchy
- **Category badges:** Muted/pastel colored pills
- **Desktop:** Content max-width ~640px centered (reading column)
- **Overall feel:** Newspaper-meets-Artifact — calm, readable

## API Changes

### New: `POST /api/gazette`
Triggers gazette generation for today.
1. Check if edition exists for today → return `{editionId, status: "ready"}` if so
2. Otherwise: fetch unread newsletters, pick 5-10 random, create edition row, return `{editionId, status: "generating", total: N}`

### New: `GET /api/gazette/[id]/stream`
SSE endpoint for progressive article loading during generation.
- For each newsletter: summarize via Gemini → insert article → push SSE event `{article, progress: {current, total}}`
- Final event: `{status: "complete"}`

### Removed
- `POST /api/newsletters/triage` — no more triage
- `GET /api/newsletters` — replaced by internal fetch within gazette generation

### Kept (unchanged)
- `GET /api/editions/[id]` — serves gazette data
- `GET /api/labels` — onboarding
- Auth routes, preferences routes

## Route Structure

### New
```
/gazette           → Today's gazette (main app view)
/gazette/[id]      → Past gazette by ID
/onboarding/label  → Label picker (simplified onboarding)
```

### Removed
```
/triage            → Deleted
/read, /read/[id]  → Replaced by /gazette routes
/stats             → Removed
```

### Redirects
- Authenticated `/` → `/gazette`
- `/gazette` with no today's edition → auto-trigger generation
- `/read`, `/triage` → redirect to `/gazette`

## Database Changes

**No schema migration needed.** Existing tables support this flow:
- `editions` — stores gazettes (one per day)
- `editionArticles` — stores summarized articles per gazette
- `newsletters` — stores fetched newsletters
- `triageDecisions` — stop writing to it, keep schema

## Components to Create/Modify

### New
- `src/app/(app)/gazette/page.tsx` — Main gazette view
- `src/app/(app)/gazette/[id]/page.tsx` — Past gazette view
- `src/components/gazette-card.tsx` — Expandable article card
- `src/components/gazette-header.tsx` — Minimal header with gear menu
- `src/components/gazette-loading.tsx` — Progressive generation UI
- `src/app/api/gazette/route.ts` — Gazette generation API
- `src/app/api/gazette/[id]/stream/route.ts` — SSE streaming API

### Modified
- `src/app/page.tsx` — Update redirect logic
- `src/middleware.ts` — Update protected routes
- `src/lib/newsletters.ts` — Add random selection function

### Removed
- `src/app/(app)/triage/page.tsx`
- `src/app/(app)/read/` (entire directory)
- `src/app/(app)/stats/page.tsx`
- `src/components/triage-card.tsx`
- `src/components/nav-bar.tsx`
- `src/app/api/newsletters/` (triage route)
