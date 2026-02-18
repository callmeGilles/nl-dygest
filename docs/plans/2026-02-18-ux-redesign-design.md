# briefflow UX Redesign Design

**Date:** 2026-02-18
**Status:** Approved
**Approach:** UI Rewrite (rebuild all pages with shadcn/ui, keep backend/API layer)

---

## Context

The MVP is functional: triage cards, newspaper view, stats page, Gmail integration, Claude summarization. However:

- Google SSO is broken (tokens on disk, no session management)
- No onboarding flow — users land on a generic home page
- UI is basic — needs Airbnb-level polish (clean cards, whitespace, micro-interactions)
- Newspaper view shows summaries but no way to read full newsletters

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth model | Single-user, session cookie | Simple, sufficient for personal tool / early product |
| UI toolkit | shadcn/ui + Tailwind | Accessible components, no lock-in, Airbnb-quality polish |
| Onboarding | 3-step guided flow (SSO → label picker → first triage) | Teaches the core loop once |
| Returning user | Smart landing based on app state | No redundant onboarding |
| Full newsletter reading | Slide-over panel | Keeps dygest list visible, email-client pattern |
| Stats focus | Reading habits first, newsletter insights second | Motivate daily use |
| Design vibe | Clean cards + whitespace + polished micro-interactions | Content-first with premium feel |

---

## 1. Auth & Session

### Current Problem
Tokens stored in `.gmail-tokens.json` on disk. No session. No way to know if user is logged in.

### Design

| Aspect | Implementation |
|--------|---------------|
| Session | HTTP-only secure cookie with session ID. Session stored in SQLite (`sessions` table) |
| Token storage | Gmail OAuth tokens in SQLite (`user_tokens` table), linked to session |
| Login | Google OAuth 2.0 flow. On callback: create session + store tokens in DB + set cookie |
| Logout | `POST /api/auth/logout` — clear cookie + delete session row |
| Auth middleware | Next.js middleware checks for valid session cookie on protected routes. Redirects to `/` if missing |
| Protected routes | Everything except `/` and `/api/auth/*` |

### New DB Tables

```sql
sessions:
  id          INTEGER PRIMARY KEY
  token       TEXT UNIQUE (uuid)
  createdAt   TEXT
  expiresAt   TEXT

user_tokens:
  id            INTEGER PRIMARY KEY
  sessionId     INTEGER FK → sessions
  accessToken   TEXT
  refreshToken  TEXT
  expiresAt     TEXT

user_preferences:
  id                  INTEGER PRIMARY KEY
  sessionId           INTEGER FK → sessions
  gmailLabel          TEXT
  onboardingCompleted INTEGER (boolean)
```

---

## 2. Onboarding Flow

Route: `/onboarding` — shown only once after first login.

### Step 1: Welcome + Google SSO
- Clean centered layout with briefflow logo
- "Connect your Gmail to get started" with Google sign-in button
- On successful auth → auto-advance to step 2

### Step 2: Pick Gmail Label
- Fetch user's Gmail labels via API
- Display as selectable cards (label name + message count)
- Pre-highlight common ones like "Newsletters" if found
- "Continue" button saves selection to `user_preferences.gmailLabel`

### Step 3: First Triage Experience
- Fetch newsletters from selected label
- Triage flow with coaching tooltip on first card
- After triaging at least 3: "Generate my first dygest" CTA
- Auto-generate edition → transition to newspaper view → stats teaser
- Mark `onboardingCompleted = true`

### Progress Indicator
- 3-dot stepper at top: `Connect · Select · Triage`
- Each step animates in with smooth transition

---

## 3. Newspaper / Dygest View

Two-panel layout. Email-client pattern with Airbnb visual polish.

### Layout

```
┌──────────────────────────────────────────────────────┐
│  briefflow          Edition #3 · Feb 18    [⚙] [👤] │
├────────────────────────┬─────────────────────────────┤
│                        │                             │
│  ┌──────────────────┐  │   Newsletter full content   │
│  │ Tech (3)         │  │                             │
│  ├──────────────────┤  │   Title: "Why RAG is..."    │
│  │ ★ Why RAG is... │◄─│   From: The Batch           │
│  │   2 min · The..  │  │   ─────────────────────     │
│  ├──────────────────┤  │                             │
│  │ AI Agents for..  │  │   [Full cleaned HTML        │
│  │   4 min · Lenny  │  │    rendered here with       │
│  ├──────────────────┤  │    proper typography]        │
│  │ Product (2)      │  │                             │
│  ├──────────────────┤  │                             │
│  │ How Notion...    │  │                             │
│  │   3 min · First  │  │                             │
│  └──────────────────┘  │                             │
│                        │                             │
├────────────────────────┴─────────────────────────────┤
│  Streak: 5 days  ·  Read: 12/18  ·  Time: 23 min    │
└──────────────────────────────────────────────────────┘
```

### Left Panel — Dygest List
- Articles grouped by category with collapsible sections
- Each card: headline, reading time, sender name, 1-line summary
- Selected card: highlighted left border (accent color)
- Unread/read visual distinction (bold vs regular weight)
- Smooth scroll, category headers stick to top

### Right Panel — Slide-over Reading Pane
- Opens when clicking an article card
- Shows: sender name, date, headline
- Content order: summary with key points first (the "dygest"), then "Read full newsletter" expandable section with cleaned HTML
- Close button or click another article to switch
- Mobile: slides over as full-screen sheet (shadcn Sheet component)

---

## 4. Triage Redesign

Same swipe mechanic, upgraded visuals.

### Card Design
- Larger card: sender logo/initial, subject, snippet (2-3 lines), received date
- Rounded corners, subtle shadow, white card on light gray background
- Swipe indicators: green glow right (keep), red glow left (skip) — gradient intensifies with drag
- Action buttons: ghost style with icons (X for skip, checkmark for keep)

### Progress
- Top: slim progress bar with "5 of 23" label
- Bottom: "Kept: 3 · Skipped: 2"
- Completion: celebratory micro-animation → "Generate your dygest" CTA

### Interaction
- Mobile: card takes ~80% viewport height, touch swipe with spring physics
- Desktop: keyboard shortcuts (← →) preserved
- Transitions: 200ms ease for interactions

---

## 5. Stats Page

### Reading Habits (Primary Section)
- **Streak card:** Large number with flame icon, weekly calendar heatmap below
- **Progress ring:** Circular chart — newsletters read vs remaining this week
- **Reading time:** Total time this week, trend arrow vs last week

### Newsletter Insights (Secondary Section)
- **Top senders:** Horizontal bar chart
- **Category breakdown:** Donut chart
- **Weekly activity:** Bar chart — reads per day

### Design
- Dashboard grid (2 columns desktop, stacked mobile)
- Same card treatment (rounded, shadow)
- Numbers count up on page load

---

## 6. Returning User Experience

When `onboardingCompleted = true`, smart landing:

| App State | Landing Page |
|-----------|-------------|
| New unread newsletters in Gmail | `/triage` with badge showing count |
| Triaged but no edition generated | Prompt to generate edition |
| Latest edition exists | `/read/[latestEditionId]` (newspaper) |
| Nothing new | `/stats` with "All caught up" message |

### Navigation Bar
Always visible: **Triage · Dygest · Stats**
- Active state indicator
- Unread badges on Triage when new newsletters available

---

## 7. Visual Design System

| Property | Value |
|----------|-------|
| Border radius | `rounded-xl` (cards), `rounded-lg` (buttons) |
| Shadows | `shadow-sm` default, `shadow-md` on hover |
| Card padding | `p-6` |
| Gap between cards | `gap-4` |
| Body text | 16-18px, system sans-serif |
| Colors | Neutral palette (slate/gray), single accent for active states |
| Hover transitions | 200ms ease |
| Panel slide | 300ms ease |
| Loading states | Skeleton shimmer placeholders |
| Mobile breakpoint | Sheet component for reading pane |

---

## Tech Stack Additions

| Addition | Purpose |
|----------|---------|
| shadcn/ui | Component library (Sheet, Card, Button, Dialog, Dropdown, Skeleton, Progress) |
| Radix UI primitives | Underlying accessible components (via shadcn) |
| framer-motion (optional) | Spring physics for swipe, count-up animations |
| uuid | Session token generation |
