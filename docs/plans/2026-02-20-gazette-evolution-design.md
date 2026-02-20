# Gazette Evolution — Design Document

> Date: 2026-02-20
> Status: Approved
> Context: Evolving Briefflow from flat random gazette to 3-tier editorial gazette with interest-driven selection

---

## Problem

The current gazette selects newsletters randomly and displays them as a flat list of equal-weight cards. There is no user signal for relevance (triage was dropped), no editorial hierarchy, and no sense of completion. The result feels arbitrary rather than curated.

## Solution

Replace the random selection + flat display with:
1. **Interest-driven selection** — user declares topics during onboarding, Gemini uses them to pick relevant content
2. **Single editorial LLM call** — Gemini receives 20-30 candidates and returns a structured 3-tier gazette
3. **3-tier gazette UI** — Headline / Worth Your Time / In Brief with clear visual hierarchy and a "done for today" footer

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Generation model | Single Gemini call (select + generate) | Simpler pipeline, better editorial coherence |
| Interests | Topic chips at onboarding (3-5 from list + free text) | Explicit signal, easy to iterate |
| Labels | Multiple Gmail labels (1-3) | Users may organize newsletters across labels |
| Feedback (skip/save) | Deferred to post-MVP | Ship the format first, add signals once validated |
| Trigger | On-demand (generate when user visits) | No infra needed, keep current model |
| Architecture | Prompt-driven, no embeddings | Overkill for single-user scale, add later if needed |
| Stack | Keep Next.js + SQLite + Drizzle + Gemini | Already working, no reason to change |
| Visual tone | Warmer, more inviting than current | Foster daily habit — gazette should feel like a treat |

---

## Data Model Changes

### New table: `userInterests`

| Column | Type | Purpose |
|--------|------|---------|
| id | integer PK | Auto-increment |
| sessionId | text FK → sessions | Links to user |
| topic | text | e.g. "AI", "Product Management" |
| createdAt | integer | Timestamp |

### Changes to `editionArticles`

New columns:
- `section` — text: `'headline'`, `'worth_your_time'`, `'in_brief'`
- `position` — integer, order within section
- `expandedSummary` — text, longer summary shown on expand (for worth_your_time and in_brief)

Existing columns reused:
- `headline` → AI-rewritten title (hook-style for all sections)
- `summary` → 3-sentence summary (headline), hook sentence (worth_your_time), one-liner (in_brief)
- `keyPoints` → takeaways array (headline + worth_your_time), null for in_brief
- `category` → renamed semantically to `interestTag` in the UI, but column stays as `category`

### Changes to `userPreferences`

- Allow storing multiple Gmail labels (change `gmailLabel` from single string to JSON array, or add a `userLabels` table)

### No changes to

`newsletters`, `editions`, `sessions`, `userTokens`, `readingSessions`, `triageDecisions`

---

## Gazette Generation Pipeline

### Current flow (replaced)

```
Random select 5-10 → Stream individual Gemini calls → Flat articles
```

### New flow

```
1. Fetch candidates
   - Query newsletters not yet in any editionArticles
   - From all user-selected Gmail labels
   - Order by receivedAt DESC
   - Limit 30

2. Single Gemini "editor" call
   - System: "You are the editor of a personal newsletter gazette"
   - Context: user's interest topics
   - Input: 20-30 candidates (sender, subject, date, first ~2000 chars)
   - Output: structured JSON (see schema below)
   - Rules: pick 7-10, enforce topic diversity, hooks not summaries

3. Store gazette
   - Create edition record
   - Create editionArticles with section + position
   - Link to source newsletters

4. Return complete gazette to client
```

### Gemini output schema

```json
{
  "headline": {
    "newsletterId": "...",
    "interestTag": "Product Management",
    "title": "Why your onboarding flow is losing 40% of users",
    "summary": "3 specific sentences with data points and names.",
    "takeaways": ["...", "...", "..."]
  },
  "worthYourTime": [
    {
      "newsletterId": "...",
      "interestTag": "Engineering",
      "hook": "One curiosity-creating sentence. Not a summary.",
      "expandedSummary": "3-4 sentences with key details.",
      "takeaways": ["...", "..."]
    }
  ],
  "inBrief": [
    {
      "newsletterId": "...",
      "interestTag": "AI",
      "oneLiner": "One sentence gist.",
      "expandedSummary": "2-3 sentences for expanded view."
    }
  ]
}
```

### Error handling

- Gemini failure or invalid JSON: retry once, then fall back to simpler prompt (summarize top 7 without hierarchy)
- Fewer than 7 unsurfaced newsletters: generate smaller gazette (minimum 3), adjust sections accordingly
- Gemini timeout (>30s): retry once

### Loading UX

Single call takes ~5-15 seconds. Show "building your gazette" loading state, reveal full gazette at once.

---

## Onboarding Flow

### 3 steps (stepper already shows 3)

| Step | Screen | Details |
|------|--------|---------|
| 1 | **Connect** | Google OAuth. Route from landing → onboarding after first login |
| 2 | **Labels** | Pick 1-3 Gmail labels. Multi-select (currently single-select). Auto-highlight "Newsletters" label if exists |
| 3 | **Interests** | Pick 3-5 topics from suggested chips + free text. Min 3, max 8. Suggested: AI, SaaS, Startups, Product, Engineering, Marketing, Finance, Design, Leadership, Health, Climate, Crypto |

After step 3: save interests → redirect to `/gazette` → first gazette generates on-demand.

---

## UI — 3-Tier Gazette

### Layout (single scroll)

**Header:** Date + "Your Daily Briefing" + source count

**Section 1 — The Headline (1 card)**
- Large card, dominant visual weight
- Interest tag chip (colored)
- AI-rewritten title (large, bold)
- Source + date (muted)
- 3-sentence summary
- 2-3 takeaway bullets
- "Read full" → ArticleOverlay

**Section 2 — Worth Your Time (2-3 cards)**
- Medium cards
- Interest tag + source
- One-sentence hook (curiosity-driven)
- Expand → reveals expanded summary + takeaways + "Read full"

**Section 3 — In Brief (4-6 items)**
- Compact list rows
- Source · Tag on one line, one-liner below
- Tap to expand → expanded summary + "Read full"

**Footer:**
- "That's it for today."
- "N sources · X in your library · Y surfaced so far"
- Completion signal — the habit builder

### Components

| Component | New/Existing | Purpose |
|-----------|-------------|---------|
| `HeadlineCard` | New | Section 1 — large featured card |
| `HookCard` | New | Section 2 — hook + expandable detail |
| `BriefItem` | New | Section 3 — compact row + expandable |
| `GazetteFooter` | New | Completion message + stats |
| `ArticleOverlay` | Existing | Full newsletter read view (no changes) |
| `GazetteHeader` | Existing | Adapt copy, keep structure |
| `GazetteLoading` | Existing | Adapt for single-call loading |

### Visual direction

Warmer than current. The gazette should feel inviting — like opening a well-made journal with morning coffee, not a productivity dashboard.

- Warm cream/amber backgrounds instead of cool grays
- Soft gradient accents
- Generous spacing, strong typographic hierarchy
- Interest tag chips in warm palette
- Headline card should feel noticeably larger/bolder than other sections
- Footer feels conclusive and satisfying

---

## What is NOT in scope

- Embeddings / vector search
- Skip/save interactions
- Scheduled generation / push notifications
- Delivery time selection
- Search or query the backlog
- Multiple gazette profiles
- Web push notifications
- Write-back to Gmail

---

## What is NOT changing

- Auth flow (Google OAuth, session cookies, middleware)
- Gmail integration (fetch/parse logic in newsletters.ts)
- ArticleOverlay (slide-over panel)
- Database engine (SQLite + Drizzle)
- AI provider (Gemini)
- Past editions dropdown
- API route structure (evolve, don't restructure)
