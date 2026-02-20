# Briefflow - MVP Specification

## Problem Statement

People subscribe to newsletters they genuinely value but can't keep up with the volume. Newsletters accumulate into a growing backlog (often 500-1500+), creating guilt and wasted potential value. No existing tool helps users triage and extract value from their backlog while preventing it from growing further.

**Core insight:** The backlog isn't a queue to process — it's a knowledge base to surface from.

---

## Product Vision

Briefflow generates a personalized daily gazette from the user's newsletter backlog, cross-cutting sources by relevance and interest rather than by sender. The user stops reading newsletters and starts consuming the insights that matter to them.

**One-liner:** Your newsletters, finally useful.

---

## Target User

- Knowledge workers / founders / operators
- Subscribed to 10-50+ newsletters
- Use Gmail with labels/filters for newsletters (primary) or newsletters scattered in inbox (secondary)
- Mobile-first consumption (commute, waiting rooms, coffee)
- Already tried and failed: Gmail filters, "I'll read it this weekend", bulk unsubscribe

---

## MVP Scope

### Onboarding (3 screens max)

| Step | Screen | Details |
|------|--------|---------|
| 1 | Google SSO | Sign in with Google. Request `gmail.readonly` scope |
| 2 | Select source | Show user's Gmail labels. User picks 1-3 labels that contain newsletters. **Future:** auto-detect newsletter senders for users without labels |
| 3 | Interests + schedule | User picks 3-5 interest topics from a suggested list (with free text option). User picks gazette delivery time (Morning / Lunch / Evening) |

**Goal:** Download → first gazette in under 2 minutes.

### Core Feature: The Daily Gazette

**What it is:** A single, personalized briefing generated from the user's newsletter backlog, delivered on schedule via push notification. Not a newspaper layout, not a flat list of summaries. A mobile-first "morning briefing" with editorial hierarchy — the AI acts as the user's personal editor.

**Design philosophy:**

- **Hierarchy, not equality.** Not all newsletters deserve the same space. The AI makes editorial decisions about what matters most today
- **Hooks, not summaries.** For most items, show a one-sentence hook that helps the user decide "do I care?" — not a paragraph they have to read before deciding
- **Tap to expand, not navigate.** Cards expand in-place (bottom sheet or inline expand). No page navigation that breaks flow
- **Clear endpoint.** The gazette has a visible end. Footer: "That's it for today. Back tomorrow." Opposite of infinite scroll. The feeling of completion is the habit builder

**How it works:**

1. AI scans newsletters in selected Gmail label(s)
2. Scores candidates using embeddings (cosine similarity against user interests) + freshness + quality signals
3. Selects 7-10 newsletters, enforces topic diversity
4. Generates gazette via LLM, structured in 3 sections
5. Push notification at user's chosen time

**Gazette structure (3 sections, single scroll):**

**Section 1 — "The Headline" (1 item)**

The single most relevant piece from your newsletters today. Large card with strong visual hierarchy:
- Newsletter source + interest tag
- Compelling title (AI-rewritten for hook value)
- 3-sentence summary
- Key takeaways (2-3 bullet points)
- "Read full" button

This is what hooks the user. If they only have 30 seconds, they get value from this alone.

**Section 2 — "Worth Your Time" (2-3 items)**

Medium cards. Each shows:
- Newsletter source
- One-sentence hook (NOT a summary — a hook that creates a desire to tap). Example: "Stripe just changed their pricing model for European SMEs"
- Interest tag it matches

Tap to expand: reveals full summary + key points + "Read full" button.

**Section 3 — "In Brief" (4-6 items)**

Compact list. One line per item:
- Source + single sentence summary
- The "you're not missing much but here's the gist" section
- Tap to expand if something catches the eye, otherwise scroll past in 5 seconds

**Footer:** "7 sources from your library today. Back tomorrow." + backlog counter ("1,247 in your library · 87 surfaced so far")

**Target reading time: 3-5 minutes** for the full gazette. This is the contract with the user.

**Visual direction:**

Clean, warm, with good typography. Not newspaper-like (no serif fonts, no columns). Not email-like (no plain text). Closer to a well-designed reading app: Substack's reading experience meets Apple's Today widget. Generous spacing, clear typographic hierarchy between sections.

**Reading flow:**

```
Push notification → Open gazette
  Section 1: Read headline card (30 sec)
  Section 2: Scan hooks, tap to expand interesting ones (1-2 min)
  Section 3: Scan brief list, tap if curious (30 sec)
  Footer: "Done for today" → Close app feeling complete

At any point:
  Tap "Read full" → Full newsletter content rendered in-app
                     (bottom sheet or full screen)
  Swipe back → Return to gazette at same scroll position
```

**Gazette behavior:**

- One gazette per day (MVP)
- New gazette replaces previous one (no gazette backlog!)
- Processed newsletters are marked/tracked internally so they don't reappear
- User can "skip" a card (signal to improve future selection)
- User can "save" a card (bookmarks for later)
- Skip/save are subtle gestures (swipe or small icon), not primary UI

### Backlog Management (passive)

The user never manually "processes" the backlog. The gazette works through it automatically over time. The app shows a simple progress indicator:

- "1,247 newsletters in your library"
- "87 surfaced so far"
- "Your backlog is your library — we'll find the gems for you"

This reframes the backlog from "guilt pile" to "personal knowledge base."

---

## What is NOT in the MVP

| Feature | Why not now |
|---------|-----------|
| On-demand gazette ("give me another") | Ship scheduled first, add later based on usage data |
| Search/query the backlog | Powerful but complex. Layer 2 feature |
| Multiple gazette profiles (work vs. personal) | Adds complexity. One gazette to start |
| Newsletter discovery / recommendations | Out of scope. Briefflow is for what you already have |
| Web app | Mobile-first. Web can come later |
| Outlook / other email providers | Gmail first (largest market). Expand later |
| Sharing / social features | Distraction from core value |
| Write-back to Gmail (mark as read, archive) | Nice to have but risky scope creep |

---

## Technical Architecture

### Stack (suggested)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile app | React Native (Expo) or Flutter | Cross-platform from day 1 |
| Backend | Node.js or Python (FastAPI) | Fast to ship, good LLM library support |
| Database | PostgreSQL + pgvector | Store newsletter metadata + embeddings for smart selection |
| AI/LLM | See "AI/LLM Pipeline" section | Model choice depends on cost/quality tradeoff |
| Email access | Gmail API (readonly) | Pull newsletter content from labeled folders |
| Push notifications | Firebase Cloud Messaging | Cross-platform push |
| Auth | Google OAuth 2.0 | SSO + Gmail API access in one flow |
| Hosting | Railway / Fly.io / Render | Simple, affordable for MVP |
| Job scheduling | BullMQ or cron | Gazette generation on user's schedule |

### Data Flow

```
[Gmail API] → Fetch newsletters from selected labels
     ↓
[Ingestion Pipeline] → Parse HTML → Extract text → Store in DB
     ↓
[Embedding Generation] → Generate embeddings for each newsletter (one-time per NL)
     ↓
[Gazette Generator] (runs on schedule per user)
     ├── Step 1: Score newsletters via embeddings (cosine similarity vs user interests)
     ├── Step 2: Select top 7-10, enforce diversity across topics
     ├── Step 3: Send selected newsletters to LLM for gazette generation
     ├── Step 4: LLM returns structured gazette (headline + worth your time + in brief)
     └── Step 5: Assemble gazette, store, trigger push
     ↓
[Push Notification] → "Your morning briefing is ready"
     ↓
[Mobile App] → Display gazette → Drill-down to full content
```

### Gmail API Considerations

- **Scope needed:** `gmail.readonly` (sensitive scope — requires Google verification)
- **Google verification process:** Plan 4-8 weeks for app review. Start early
- **Rate limits:** 250 quota units/user/second. Batch fetching is fine
- **Initial sync:** For 1500 newsletters, initial pull could take a few minutes. Show progress bar during onboarding
- **Incremental sync:** After initial load, use `history.list` to fetch only new messages
- **Content parsing:** Newsletter HTML varies wildly. Use a library like `mozilla/readability` or `postlight/parser` to extract clean text
- **Storage:** Store extracted text + metadata, not raw HTML (saves space, improves processing)

### AI/LLM Pipeline

**Step 1 — Relevance scoring (embeddings, no LLM cost):**

Use vector embeddings to score newsletters against user interests. Generate one embedding per newsletter at ingestion time (one-time cost). Generate embeddings for user interest keywords. Score by cosine similarity using pgvector. This is nearly free at scale and avoids expensive LLM calls for scoring.

Only the top 7-10 scored candidates are sent to the LLM.

**Step 2 — Gazette generation (LLM call, per user, on schedule):**

Single LLM call with the 7-10 selected newsletters as context. The prompt asks the LLM to:
- Assign each newsletter to a gazette section (Headline / Worth Your Time / In Brief)
- For the Headline: write a 3-sentence summary + 2-3 key takeaways
- For Worth Your Time items: write a one-sentence hook per item + full summary (shown on expand)
- For In Brief items: write a one-sentence summary per item
- Tag each item with the matching user interest
- Consider time-sensitivity: flag if content is still relevant despite age

**Cost analysis (realistic estimates):**

Typical newsletter: 1,500-3,000 words = 2,000-4,000 tokens. Some newsletters (Morning Brew, Lenny's, etc.) can be 5,000-8,000 tokens. Conservative average: 3,000 tokens per newsletter.

Gazette generation input: 7-10 newsletters × 3,000 tokens = 21,000-30,000 tokens + prompt ≈ 25-35K input tokens.
Gazette generation output: structured gazette ≈ 4,000-5,000 tokens.

| Model | Input cost | Output cost | Per gazette | Per user/month |
|-------|-----------|-------------|-------------|----------------|
| Claude Sonnet ($3/$15 per MTok) | $0.09 | $0.075 | ~$0.17 | ~$5.10 |
| Claude Haiku 3.5 ($0.80/$4 per MTok) | $0.024 | $0.02 | ~$0.04 | ~$1.20 |
| GPT-4o-mini ($0.15/$0.60 per MTok) | $0.005 | $0.003 | ~$0.008 | ~$0.24 |
| Gemini Flash 2.0 ($0.10/$0.40 per MTok) | $0.003 | $0.002 | ~$0.005 | ~$0.15 |

**Recommendation for MVP:** Start with GPT-4o-mini or Gemini Flash for cost efficiency. Summarization quality is sufficient for this task. Upgrade to Haiku or Sonnet for premium tier or if quality is insufficient.

Embedding costs (for relevance scoring) are negligible: ~$0.0001 per newsletter with ada-002 or similar.

**Important:** Without the embeddings optimization (if using LLM for scoring instead), costs increase 3-5x because you'd send 20-30 full newsletters to the LLM just to score them before gazette generation.

---

## Key Metrics (MVP)

| Metric | What it tells you | Target |
|--------|------------------|--------|
| Onboarding completion rate | Is the flow too complex? | > 70% |
| Daily gazette open rate | Is the content relevant? | > 50% |
| Drill-down rate (section 2 tap-to-expand) | Are hooks compelling? | > 40% of section 2 cards |
| "Read full" rate | Are we surfacing the right newsletters? | > 10% of cards |
| Section 3 expand rate | Is "In Brief" useful or ignored? | > 15% of section 3 items |
| D7 retention | Does the habit stick? | > 40% |
| D30 retention | Is there lasting value? | > 25% |
| Skip rate per card | Are we picking poorly? | < 30% |
| Time in gazette | Engagement depth | 2-4 minutes average |

**North star metric:** Daily gazette open rate. If users open it, the product works.

---

## Monetization (thinking ahead, not MVP)

| Model | Details |
|-------|---------|
| Freemium | Free: 1 gazette/day from 1 label, 3 interests. Pro: multiple labels, unlimited interests, on-demand gazettes, search the backlog |
| Price point | $5-8/month (aligned with Meco, Readless, etc.) |
| Free trial | 14 days full access, then downgrade to free tier |

**Unit economics note:** At $7/month price point and GPT-4o-mini costs (~$0.24/month/user), gross margin is ~97%. Even with Haiku (~$1.20/month), margin is ~83%. Sonnet ($5.10/month) only works for premium pricing.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Google verification delay | Blocks launch by weeks | Start verification process immediately, before app is finished |
| Newsletter HTML parsing quality | Bad text extraction = bad summaries | Invest in robust parsing. Test against 50+ real newsletter formats |
| LLM hallucination in summaries | User loses trust if summary misrepresents content | Include "Read full" always visible. Use conservative prompting with source attribution |
| "Random gazette" feeling | User gets irrelevant content, stops opening | Interest-based embeddings selection from day 1. Let user skip/save to improve |
| Hooks don't hook | Section 2 hooks feel generic, no one expands | A/B test hook styles. Fallback: show 2-sentence summaries instead of hooks |
| Gazette feels too short/too long | User unsatisfied with content volume | Track time-in-gazette. Target 3-5 min. Adjust section sizes based on data |
| Competing with Gmail AI features | Google could add native newsletter summaries | Move fast. Google's features will be generic — Briefflow is specialized and opinionated |
| Privacy concerns (reading all email) | Users hesitant to grant access | Clear messaging: "We only read newsletters in your selected labels." Privacy policy front and center |
| LLM costs at scale | Margins erode with expensive models | Start with GPT-4o-mini/Gemini Flash. Embeddings for scoring (not LLM). Monitor cost per user |

---

## MVP Development Roadmap

### Phase 1 — Foundation (Weeks 1-3)
- Google OAuth + Gmail API integration
- Newsletter ingestion pipeline (fetch, parse, store)
- Database schema + embedding generation (pgvector)
- Relevance scoring via cosine similarity

### Phase 2 — Gazette Engine (Weeks 3-5)
- Newsletter selection algorithm (embeddings + diversity + freshness)
- LLM gazette generation prompt (3-section structure: headline / worth your time / in brief)
- Gazette assembly and storage
- Scheduled job system (per-user cron)

### Phase 3 — Mobile App (Weeks 4-7)
- Onboarding flow (SSO → labels → interests → schedule)
- Gazette display: 3-section layout with card hierarchy
  - Section 1: large headline card with summary + takeaways
  - Section 2: medium hook cards with tap-to-expand (bottom sheet with full summary)
  - Section 3: compact list with tap-to-expand
  - Footer with completion message + backlog counter
- "Read full" → full newsletter content in-app
- Push notifications
- Skip/save interactions (swipe or icon)

### Phase 4 — Polish & Launch (Weeks 7-8)
- Performance optimization (initial sync speed)
- Error handling & edge cases
- Privacy policy & terms
- App Store / Play Store submission
- Google API verification (start in week 1!)

**Total estimated time to MVP: 8 weeks** with a focused team.

---

## Open Questions to Decide

1. **React Native vs Flutter?** Depends on team expertise. Both work fine
2. **Do we need a web app for MVP?** Recommendation: no. Mobile-only to stay focused
3. **How do we handle newsletters without a Gmail label?** V1: require labels. V1.1: auto-detect newsletter senders
4. **Should we support multiple Gmail accounts?** V1: single account. V1.1: multiple
5. **Gazette language?** V1: match newsletter language (most LLMs handle this). Consider French market specifically given your user base
6. **Beta distribution?** TestFlight (iOS) + Google Play internal testing. Target 50-100 beta users from your network
7. **LLM provider?** GPT-4o-mini recommended for MVP cost efficiency. Test Gemini Flash as alternative. Evaluate quality before committing
8. **Expand card UX?** Bottom sheet (iOS-native feel) vs inline expand (simpler). Test both in prototype
