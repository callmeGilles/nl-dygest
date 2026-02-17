# nl-dygest — Design Document

**Date:** 2026-02-17
**Status:** Approved

## Problem

~1500 unread newsletters accumulated in Gmail over 2 years. 1-5 new newsletters arrive daily. The goal is to build a sustainable daily reading habit (10-15 min) so the backlog shrinks naturally over time.

## Solution

A web app with two phases:

1. **Triage** — Tinder-style card swiping to quickly select which newsletters to read today
2. **Newspaper** — An interactive, typographic newspaper layout generated from the selected newsletters using LLM summarization

## User Flow

```
Triage (2-3 min)          Generate (~30s)         Read (10-15 min)
─────────────────    →    ──────────────    →    ──────────────────
Swipe through cards       LLM processes          Interactive newspaper
Keep or skip each         kept newsletters       grouped by category
                          Summarize + categorize  Expandable articles
```

## Architecture

```
Gmail (OAuth) → Next.js API Routes → Claude API → Next.js Frontend
                      ↕                                   ↕
                   SQLite (Drizzle ORM)
```

### Stack

| Layer | Tech | Rationale |
|-------|------|-----------|
| Frontend | Next.js (App Router) | SSR for newspaper layout, API routes for backend |
| Backend | Next.js API routes | Single app, no separate backend |
| Database | SQLite (Drizzle ORM) | Zero infrastructure, file-based, single user |
| Gmail | googleapis npm package | Official Google API client |
| AI | Claude API (@anthropic-ai/sdk) | Summarization, categorization, key point extraction |
| Auth | Google OAuth 2.0 | Required for Gmail API |
| Content extraction | mozilla/readability | HTML → clean readable text |
| Hosting | Local first, optionally Vercel | Side project, personal tool |

## Data Model

### newsletters
| Field | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-increment |
| gmail_id | text (unique) | Gmail message ID |
| sender | text | Sender name/email |
| subject | text | Email subject line |
| snippet | text | First ~100 words preview |
| received_at | datetime | When the email was received |
| raw_html | text | Full email HTML body |

### triage_decisions
| Field | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-increment |
| newsletter_id | integer (FK) | Reference to newsletters |
| decision | text | "kept" or "skipped" |
| triaged_at | datetime | When the decision was made |

### editions
| Field | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-increment |
| generated_at | datetime | When the edition was generated |
| content_json | text (JSON) | Structured edition content |

### edition_articles
| Field | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-increment |
| edition_id | integer (FK) | Reference to editions |
| newsletter_id | integer (FK) | Reference to newsletters |
| category | text | Tech/Product/Business/Design/Other |
| headline | text | LLM-generated headline (max 10 words) |
| summary | text | 2-3 sentence summary |
| key_points | text (JSON) | 3-5 bullet points |
| reading_time | integer | Estimated minutes to read original |

### reading_sessions
| Field | Type | Description |
|-------|------|-------------|
| id | integer (PK) | Auto-increment |
| date | date | Session date |
| newsletters_read | integer | Count of articles read |
| time_spent | integer | Minutes spent reading |

## Gmail Integration

- **Scope:** `gmail.modify` (read + label management)
- **Source:** Configurable Gmail label/folder (e.g., "Newsletters")
- **After triage:**
  - Skipped → marked as read in Gmail
  - Kept → labeled `nl-dygest/kept`
- **After reading:** Optionally mark as read

## LLM Processing Pipeline

```
Raw HTML
  → mozilla/readability (extract clean text)
  → Claude API prompt:
      "Summarize this newsletter. Return:
       - category (Tech/Product/Business/Design/Other)
       - headline (max 10 words)
       - summary (2-3 sentences)
       - key_points (3-5 bullet points)
       - estimated_reading_time"
  → Store structured result in edition_articles
```

## Frontend Views

### Triage View (`/triage`)
- Card stack UI, one newsletter at a time
- Each card: sender name, subject, first ~100 words, date, estimated read time
- Swipe gestures (touch) + keyboard shortcuts (←/→) + button clicks
- Progress bar showing remaining count
- "Generate my edition" button when done (or auto-triggers)

### Newspaper View (`/read` or `/edition/[date]`)
- Clean typographic layout
- Header with date and edition number
- Stats bar: streak counter, newsletters read this week, remaining count
- Articles grouped by category with section dividers
- Each article: headline, summary, key points (collapsed by default)
- Click to expand full content inline
- "Read original" link to full newsletter

### Stats Page (`/stats`)
- Weekly reading chart
- Newsletters processed over time
- Top senders
- Streak history

### Settings (`/settings`)
- Gmail connection management
- Preferred categories
- No onboarding wizard — just "Connect Gmail" on first visit

## Habit Reinforcement

- Streak counter displayed prominently
- Progress tracking (backlog remaining)
- Reading stats to visualize consistency
- Daily edition creates a ritual around opening the newspaper

## Scope Boundaries

- Single user, personal tool
- No multi-user auth or team features
- No push notifications (for now)
- No mobile native app — responsive web only
- No pre-processing/batch jobs — on-demand generation only
