# Briefflow - MVP Technical Specification

> **Purpose of this document:** Implementation-ready spec for building the Briefflow MVP. Written for an AI coding assistant (Claude Code) or developer to build from. Every section contains concrete decisions, not options.

---

## 1. What Briefflow Does

Briefflow generates a personalized daily gazette from the user's newsletter backlog (Gmail). Instead of reading newsletters one by one, the user gets a 3-5 minute briefing that surfaces the most relevant content across all their subscriptions.

**One-liner:** Your newsletters, finally useful.

**Core loop:**
```
User connects Gmail → AI ingests newsletters → Daily gazette generated on schedule
→ Push notification → User reads gazette in app (3-5 min) → Done for the day
```

---

## 2. Target User

- Knowledge workers, founders, operators
- Subscribed to 10-50+ newsletters
- Gmail users (primary email provider)
- Mobile-first consumption (commute, waiting, coffee break)
- Pain: valuable newsletters pile up unread, guilt builds, no way to catch up

---

## 3. Tech Stack (Decisions Made)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Mobile | React Native (Expo) | Cross-platform. Use Expo Router for navigation |
| Backend | Python (FastAPI) | Good LLM library support, async-friendly |
| Database | PostgreSQL + pgvector extension | Newsletter storage + vector similarity search |
| LLM | GPT-4o-mini (primary), Gemini Flash 2.0 (fallback) | Cost-optimized for summarization |
| Embeddings | OpenAI text-embedding-3-small | For newsletter relevance scoring |
| Email | Gmail API (readonly scope) | Pull from user-selected labels |
| Push | Firebase Cloud Messaging (FCM) | Cross-platform push notifications |
| Auth | Google OAuth 2.0 | Single flow for SSO + Gmail API consent |
| Hosting | Railway or Fly.io | Simple deploy, PostgreSQL included |
| Job queue | Celery + Redis (or APScheduler for simpler start) | Per-user scheduled gazette generation |
| HTML parsing | mozilla/readability (JS) or readabilipy (Python) | Extract clean text from newsletter HTML |

---

## 4. Database Schema

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    google_access_token TEXT,
    google_refresh_token TEXT,
    token_expires_at TIMESTAMP,
    gazette_time VARCHAR(10) NOT NULL DEFAULT '08:00',  -- HH:MM in user's timezone
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Gmail labels the user selected for newsletter ingestion
CREATE TABLE user_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    gmail_label_id VARCHAR(255) NOT NULL,
    gmail_label_name VARCHAR(255) NOT NULL,
    last_sync_history_id VARCHAR(255),  -- For incremental sync via history.list
    created_at TIMESTAMP DEFAULT NOW()
);

-- User interests (used for relevance scoring)
CREATE TABLE user_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(255) NOT NULL,
    embedding VECTOR(1536),  -- Pre-computed embedding for this interest
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ingested newsletters
CREATE TABLE newsletters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    subject VARCHAR(500),
    received_at TIMESTAMP NOT NULL,
    extracted_text TEXT NOT NULL,
    word_count INTEGER,
    embedding VECTOR(1536),  -- For relevance scoring
    ingested_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, gmail_message_id)
);

-- Generated gazettes
CREATE TABLE gazettes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    generated_at TIMESTAMP DEFAULT NOW(),
    gazette_date DATE NOT NULL,
    content JSONB NOT NULL,  -- Structured gazette (see Gazette JSON Schema below)
    model_used VARCHAR(50),
    input_tokens INTEGER,
    output_tokens INTEGER,
    generation_cost_usd DECIMAL(10, 6),
    opened_at TIMESTAMP,  -- When user first opened it
    UNIQUE(user_id, gazette_date)
);

-- Tracks which newsletters have been surfaced in a gazette
CREATE TABLE gazette_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gazette_id UUID REFERENCES gazettes(id) ON DELETE CASCADE,
    newsletter_id UUID REFERENCES newsletters(id) ON DELETE CASCADE,
    section VARCHAR(20) NOT NULL,  -- 'headline', 'worth_your_time', 'in_brief'
    position INTEGER NOT NULL,     -- Order within section
    user_action VARCHAR(20),       -- NULL, 'skipped', 'saved', 'expanded', 'read_full'
    action_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_newsletters_user_received ON newsletters(user_id, received_at DESC);
CREATE INDEX idx_newsletters_embedding ON newsletters USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_gazettes_user_date ON gazettes(user_id, gazette_date DESC);
CREATE INDEX idx_gazette_items_newsletter ON gazette_items(newsletter_id);
```

---

## 5. Gazette JSON Schema

The `gazettes.content` JSONB column stores the full gazette structure. This is what the mobile app renders.

```json
{
  "date": "2026-02-19",
  "total_sources": 8,
  "headline": {
    "newsletter_id": "uuid",
    "sender_name": "Lenny's Newsletter",
    "sender_email": "lenny@substack.com",
    "interest_tag": "Product Management",
    "title": "Why your onboarding flow is losing 40% of users",
    "summary": "Lenny Rachitsky analyzed onboarding data from 50+ B2B SaaS companies and found a consistent pattern: the biggest drop-off happens not at signup, but at the second session. The fix isn't more tooltips — it's designing for the 'aha moment' to happen before the user leaves the first time.",
    "takeaways": [
      "Second-session drop-off is 3x worse than first-session in most B2B products",
      "Companies that front-load value (show results before asking for setup) retain 2x better",
      "The 'aha moment' needs to happen in under 4 minutes for mobile-first products"
    ]
  },
  "worth_your_time": [
    {
      "newsletter_id": "uuid",
      "sender_name": "The Pragmatic Engineer",
      "sender_email": "gergely@pragmaticengineer.com",
      "interest_tag": "Engineering",
      "hook": "Stripe just rewrote their entire billing engine — and the architectural choices explain why most billing systems fail.",
      "expanded_summary": "Gergely breaks down Stripe's multi-year billing rewrite...",
      "expanded_takeaways": [
        "Takeaway 1",
        "Takeaway 2"
      ]
    }
  ],
  "in_brief": [
    {
      "newsletter_id": "uuid",
      "sender_name": "TLDR",
      "sender_email": "dan@tldr.tech",
      "interest_tag": "AI",
      "one_liner": "OpenAI launched a new fine-tuning API that cuts costs by 60% for small models.",
      "expanded_summary": "Optional longer summary shown on tap..."
    }
  ],
  "footer": {
    "sources_today": 8,
    "library_total": 1247,
    "library_surfaced": 87
  }
}
```

---

## 6. API Endpoints

### Auth

```
POST /auth/google
  Body: { "code": "google_auth_code" }
  Returns: { "access_token": "jwt", "user": { ... } }
  Notes: Exchanges Google auth code for tokens. Creates user if new.
         Stores google_access_token + google_refresh_token for Gmail API.
```

### Onboarding

```
GET /onboarding/labels
  Auth: Bearer token
  Returns: { "labels": [{ "id": "Label_123", "name": "Newsletters" }, ...] }
  Notes: Fetches user's Gmail labels via Gmail API. Filter to show only
         user-created labels (exclude INBOX, SENT, SPAM, etc.)

POST /onboarding/setup
  Auth: Bearer token
  Body: {
    "label_ids": ["Label_123", "Label_456"],
    "interests": ["AI", "SaaS", "Product Management", "Bootstrapping"],
    "gazette_time": "08:00",
    "timezone": "Europe/Paris"
  }
  Returns: { "status": "ok", "initial_sync_started": true }
  Notes: Saves preferences. Triggers initial newsletter sync as background job.
         Computes embeddings for interest topics immediately.

GET /onboarding/sync-status
  Auth: Bearer token
  Returns: { "status": "syncing|complete", "total": 1247, "processed": 830 }
  Notes: Polled by mobile app to show sync progress bar.
```

### Gazette

```
GET /gazette/today
  Auth: Bearer token
  Returns: Gazette JSON (see schema above) or { "status": "generating|not_ready" }
  Notes: Returns the gazette for today. If not yet generated, returns status.

GET /gazette/:id
  Auth: Bearer token
  Returns: Full gazette JSON by ID

POST /gazette/:gazette_id/items/:item_id/action
  Auth: Bearer token
  Body: { "action": "skipped|saved|expanded|read_full" }
  Notes: Records user interaction with a gazette item. Used to improve
         future selection.
```

### Newsletter Content

```
GET /newsletters/:id/content
  Auth: Bearer token
  Returns: { "id": "uuid", "sender_name": "...", "subject": "...",
             "content_html": "...", "content_text": "...", "received_at": "..." }
  Notes: Returns full newsletter content for "Read full" view.
         Content is the cleaned/parsed version stored at ingestion.
```

---

## 7. Gazette Generation Pipeline

This is the core intelligence of the app. Runs as a scheduled background job per user.

### Step 1: Candidate Selection (no LLM, embeddings only)

```python
def select_candidates(user_id: str, limit: int = 30) -> list[Newsletter]:
    """
    Select candidate newsletters for today's gazette.
    Uses pgvector cosine similarity against user interests.
    
    Query:
    - From user's newsletters table
    - NOT already in any gazette_items (never re-surface)
    - Ordered by: relevance_score * freshness_weight
    - Limit to top 30 candidates
    
    Relevance score: max cosine similarity between newsletter embedding
    and any of the user's interest embeddings.
    
    Freshness weight:
    - < 7 days old: 1.0
    - 7-30 days: 0.8
    - 30-90 days: 0.5
    - > 90 days: 0.3
    (Old content can still surface if relevance is very high)
    """
```

### Step 2: LLM Gazette Generation

From the 30 candidates, pick the final 7-10 and generate the gazette in a single LLM call.

**LLM Prompt Template:**

```
You are the editor of a personal newsletter gazette. Your job is to select the most valuable newsletters for this reader and present them in a structured briefing.

## Reader Profile
Interests: {user_interests}

## Candidate Newsletters (ranked by relevance)
{for each candidate}
---
ID: {newsletter_id}
From: {sender_name}
Subject: {subject}
Date: {received_at}
Relevance score: {score}
Content:
{extracted_text (truncated to first 3000 tokens if longer)}
---
{end for}

## Your Task

Select 7-10 newsletters and assign them to sections:

1. **HEADLINE** (exactly 1): The single most valuable, relevant, and interesting piece today. Pick content that would make the reader glad they opened the gazette.

2. **WORTH YOUR TIME** (2-3): Strong content the reader should consider reading in full. For each, write a HOOK — one sentence that creates curiosity and helps the reader decide if they care. Do NOT write a summary. Write a hook. Good hook example: "Stripe just rewrote their entire billing engine — the architectural choices explain why most billing systems fail." Bad hook example: "This newsletter discusses Stripe's billing system changes."

3. **IN BRIEF** (4-6): Content worth knowing about but not worth deep reading today. One sentence each — give the reader the gist so they don't feel they missed anything.

## Output Format

Respond in this exact JSON structure:
{
  "headline": {
    "newsletter_id": "...",
    "interest_tag": "...",
    "title": "compelling title (can be rewritten from subject for hook value)",
    "summary": "3 sentences. Be specific, include data points and names. No filler.",
    "takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"]
  },
  "worth_your_time": [
    {
      "newsletter_id": "...",
      "interest_tag": "...",
      "hook": "One sentence that creates curiosity. Make the reader want to tap.",
      "expanded_summary": "3-4 sentences with key details for the expanded view.",
      "expanded_takeaways": ["takeaway 1", "takeaway 2"]
    }
  ],
  "in_brief": [
    {
      "newsletter_id": "...",
      "interest_tag": "...",
      "one_liner": "One sentence — the gist.",
      "expanded_summary": "2-3 sentences for optional expanded view."
    }
  ]
}

## Rules
- Ensure topic diversity: don't pick 5 newsletters about the same thing
- Prefer recent content slightly, but old gems (high relevance) can be headline
- Be specific in summaries: names, numbers, concrete claims. Never write "this newsletter discusses..."
- Hooks must create a desire to know more. Not summaries. Not descriptions.
- If a newsletter is clearly outdated or time-sensitive and expired, skip it
- Output valid JSON only. No markdown, no commentary.
```

### Step 3: Assemble and Store

After LLM response:
1. Parse JSON response
2. Enrich with sender_name, sender_email from newsletters table
3. Compute footer stats (library_total, library_surfaced)
4. Store as gazette record with JSONB content
5. Create gazette_items records for tracking
6. Trigger push notification via FCM

---

## 8. Gmail Sync Pipeline

### Initial Sync (on onboarding)

```
1. For each selected label:
   a. Call gmail.users.messages.list(labelIds=[label_id], maxResults=500)
   b. Paginate through all messages (may need multiple calls)
   c. For each message ID:
      - Fetch full message: gmail.users.messages.get(id, format='full')
      - Extract: sender, subject, date, HTML body
      - Parse HTML to clean text (readability library)
      - Store in newsletters table
      - Generate embedding (batch after all fetched)
   d. Store the latest historyId for incremental sync

2. Report progress via /onboarding/sync-status endpoint
   (frontend polls every 2 seconds during sync)
```

### Incremental Sync (runs before each gazette generation)

```
1. Call gmail.users.history.list(startHistoryId=last_sync_history_id)
2. Get new message IDs added to watched labels
3. Fetch and process only new messages
4. Update last_sync_history_id
```

### HTML Parsing Notes

Newsletter HTML is notoriously messy. Key considerations:
- Use readability/readabilipy to extract main content
- Strip tracking pixels, footer links, unsubscribe blocks
- Preserve paragraph structure (important for LLM comprehension)
- Handle edge cases: image-only newsletters (skip), very short newsletters (< 100 words, skip)
- Store both cleaned text (for LLM) and simplified HTML (for "Read full" view in app)

---

## 9. Mobile App Screens

### Screen 1: Splash / Login
- App logo + tagline "Your newsletters, finally useful."
- Single button: "Sign in with Google"
- Triggers Google OAuth flow (SSO + gmail.readonly consent)

### Screen 2: Select Labels
- Header: "Where are your newsletters?"
- List of user's Gmail labels with checkboxes
- User selects 1-3 labels
- Helper text: "Pick the labels or folders where your newsletters land"
- Button: "Continue"

### Screen 3: Interests & Schedule
- Header: "What topics matter to you?"
- Suggested topic chips (tappable): AI, SaaS, Startups, Product Management, Engineering, Marketing, Finance, Design, Leadership, Health, Climate, Crypto, Creator Economy
- Free text input: "Add your own..."
- User selects 3-5 topics
- Schedule selector: "When do you want your briefing?"
  - Morning (8:00) / Lunch (12:00) / Evening (18:00) — or time picker
- Button: "Start syncing"

### Screen 4: Sync Progress
- Header: "Building your library..."
- Progress bar with count: "Processing 847 of 1,247 newsletters"
- Animated illustration or subtle animation
- Text: "Your first gazette will be ready at [time]"
- When done: "Your library is ready! Your first gazette arrives at [time]."
- Button: "Got it" (goes to home/empty state)

### Screen 5: Gazette View (Main Screen)

This is the core experience. Single scrollable view with 3 sections.

**Visual hierarchy is critical.** The design should feel like a curated morning briefing, not a list of emails.

**Visual direction:** Clean, warm, generous spacing, strong typographic hierarchy. Not newspaper-like (no serif, no columns). Not email-like (no plain text). Closer to Substack's reading experience meets Apple's Today widget.

```
┌─────────────────────────────────┐
│  📅 Wednesday, Feb 19           │
│  Your Daily Briefing            │
│  8 sources from your library    │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │ ★ THE HEADLINE          │    │
│  │                         │    │
│  │ Product Management      │    │  ← interest tag (subtle chip)
│  │                         │    │
│  │ Why your onboarding     │    │  ← large title, bold
│  │ flow is losing 40%      │    │
│  │ of users                │    │
│  │                         │    │
│  │ from Lenny's Newsletter │    │  ← source, smaller, muted
│  │                         │    │
│  │ Lenny analyzed data     │    │  ← 3-sentence summary
│  │ from 50+ B2B SaaS...   │    │
│  │                         │    │
│  │ • Second-session drop   │    │  ← takeaways
│  │   is 3x worse than...  │    │
│  │ • Front-load value...   │    │
│  │ • Aha moment < 4 min   │    │
│  │                         │    │
│  │ [Read full →]           │    │  ← button
│  └─────────────────────────┘    │
│                                 │
│  WORTH YOUR TIME                │  ← section header
│                                 │
│  ┌─────────────────────────┐    │
│  │ Engineering             │    │  ← interest tag
│  │ The Pragmatic Engineer  │    │  ← source
│  │                         │    │
│  │ Stripe just rewrote     │    │  ← hook (one sentence only)
│  │ their entire billing    │    │
│  │ engine — the choices    │    │
│  │ explain why most fail.  │    │
│  │                    [v]  │    │  ← expand chevron
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ SaaS                    │    │  (when tapped, expands via
│  │ SaaStr                  │    │   bottom sheet showing full
│  │                         │    │   summary + takeaways +
│  │ Bootstrapped to $10M    │    │   "Read full" button)
│  │ ARR with zero sales     │    │
│  │ hires — here's how.     │    │
│  │                    [v]  │    │
│  └─────────────────────────┘    │
│                                 │
│  IN BRIEF                       │  ← section header
│                                 │
│  ┌─────────────────────────┐    │
│  │ TLDR · AI               │    │  ← source · tag on same line
│  │ OpenAI launched a new   │    │  ← one-liner
│  │ fine-tuning API, 60%    │    │
│  │ cheaper for small...    │    │
│  ├─────────────────────────┤    │
│  │ Morning Brew · Finance  │    │
│  │ Fed signals no rate     │    │
│  │ cuts before Q3...       │    │
│  ├─────────────────────────┤    │
│  │ Dense Discovery · AI    │    │
│  │ Google DeepMind's new   │    │
│  │ protein folding model...│    │
│  ├─────────────────────────┤    │
│  │ Stratechery · Strategy  │    │
│  │ Why Apple's Vision Pro  │    │
│  │ pivot matters more...   │    │
│  └─────────────────────────┘    │
│                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                 │
│  That's it for today ✓          │  ← completion signal
│  8 sources · 1,247 in your     │
│  library · 87 surfaced so far  │
│                                 │
│  Back tomorrow at 8:00 AM       │
│                                 │
└─────────────────────────────────┘
```

**Interactions:**
- Section 2 cards: tap to expand (bottom sheet) → shows expanded_summary + expanded_takeaways + "Read full" button
- Section 3 items: tap to expand → shows expanded_summary + "Read full" button
- Any "Read full" button → full-screen view of newsletter cleaned content
- Swipe left on any card → "Skip" (negative signal for future selection)
- Swipe right or tap bookmark icon → "Save" (positive signal)
- Pull to refresh → check if new gazette is available

### Screen 6: Read Full (Newsletter Detail)

- Full-screen modal or pushed screen
- Top bar: sender name + date + close button
- Rendered cleaned HTML content (not raw email HTML)
- Bottom: "Back to gazette" button
- Reading progress indicator (optional, nice-to-have)

### Screen 7: Settings

- **My Interests**: edit topics (add/remove)
- **Newsletter Sources**: change Gmail labels
- **Gazette Time**: change delivery schedule
- **Saved Items**: list of bookmarked gazette items
- **Library Stats**: total newsletters, surfaced count, top senders
- **Account**: sign out, delete account
- **About**: privacy policy, terms

---

## 10. Push Notifications

Single daily notification at the user's chosen time:

```
Title: "Your briefing is ready"
Body: "8 sources today — including why your onboarding loses 40% of users"
       (uses the headline title as teaser)
```

Implementation:
- After gazette is generated and stored, send FCM push
- Store FCM device token on user record (set during onboarding)
- Deep link: notification tap opens gazette view directly

---

## 11. Cost Model

### Per-User Monthly Costs

| Component | Cost/user/month | Notes |
|-----------|----------------|-------|
| LLM (GPT-4o-mini) | ~$0.24 | 30 gazettes x ~$0.008 each |
| Embeddings | ~$0.01 | One-time per newsletter, negligible |
| Gmail API | $0 | Free within quota |
| Push (FCM) | $0 | Free tier sufficient |
| Hosting (backend) | ~$0.10-0.50 | Depends on scale, amortized |
| Database | ~$0.10-0.30 | PostgreSQL hosting, amortized |
| **Total** | **~$0.50-1.00** | |

### LLM Cost Details

Gazette generation input: 7-10 newsletters x ~3,000 tokens avg = 25-35K input tokens + prompt.
Gazette generation output: ~4,000-5,000 tokens.

| Model | Per gazette | Per user/month | Viable at $7/mo? |
|-------|------------|----------------|-------------------|
| GPT-4o-mini ($0.15/$0.60 per MTok) | ~$0.008 | ~$0.24 | Yes (97% margin) |
| Gemini Flash 2.0 ($0.10/$0.40 per MTok) | ~$0.005 | ~$0.15 | Yes (98% margin) |
| Claude Haiku 3.5 ($0.80/$4 per MTok) | ~$0.04 | ~$1.20 | Yes (83% margin) |
| Claude Sonnet ($3/$15 per MTok) | ~$0.17 | ~$5.10 | Tight (27% margin) |

**Important cost-saving decision:** Relevance scoring uses embeddings (cosine similarity via pgvector), NOT LLM calls. Without this optimization, scoring 30 candidates via LLM would cost 3-5x more.

**MVP recommendation:** GPT-4o-mini. Upgrade to Haiku if quality is insufficient.

### Pricing

- **Free tier**: 1 gazette/day, 1 Gmail label, 3 interests
- **Pro ($7/month)**: Multiple labels, unlimited interests, on-demand gazette, saved items history
- **Free trial**: 14 days full access, then downgrade

---

## 12. Key Metrics to Track

| Metric | Target | How to measure |
|--------|--------|---------------|
| Onboarding completion | > 70% | Track step dropoff in analytics |
| Daily gazette open rate | > 50% | `gazettes.opened_at IS NOT NULL` |
| Section 2 expand rate | > 40% | `gazette_items.user_action = 'expanded'` for worth_your_time |
| "Read full" rate | > 10% | `gazette_items.user_action = 'read_full'` |
| Skip rate | < 30% | `gazette_items.user_action = 'skipped'` |
| D7 retention | > 40% | Users who open gazette on 3+ of first 7 days |
| D30 retention | > 25% | Users who open gazette on 10+ of first 30 days |

**North star: daily gazette open rate.** If users open it, the product works.

---

## 13. Not in MVP (Explicit Exclusions)

Do NOT build these:
- On-demand gazette ("give me another one")
- Search or query the backlog
- Multiple gazette profiles (work vs personal)
- Newsletter discovery or recommendations
- Web app (mobile only)
- Outlook or other email providers
- Social/sharing features
- Write-back to Gmail (mark read, archive)
- User analytics dashboard
- Newsletter sender management (block/prioritize)

---

## 14. Build Order

### Phase 1 — Backend Foundation (Week 1-2)
1. Database setup (PostgreSQL + pgvector on Railway/Fly)
2. Google OAuth flow (exchange code → store tokens → refresh logic)
3. Gmail API integration (fetch labels, fetch messages, parse HTML)
4. Newsletter ingestion pipeline (fetch → parse → store → embed)
5. Basic API endpoints: auth, onboarding/labels, onboarding/setup, sync-status

### Phase 2 — Gazette Engine (Week 2-3)
1. Relevance scoring (cosine similarity query via pgvector)
2. Candidate selection algorithm (relevance x freshness, diversity enforcement)
3. LLM gazette generation (prompt template from section 7, structured JSON output)
4. Gazette storage and API endpoint (GET /gazette/today)
5. Scheduled job system (per-user gazette generation at their chosen time)
6. FCM push notification after gazette generation

### Phase 3 — Mobile App (Week 3-5)
1. Expo project setup + navigation (Expo Router)
2. Google Sign-In screen
3. Onboarding flow (labels → interests → schedule → sync progress)
4. Gazette main view (3-section layout with card hierarchy)
5. Card expand interaction (bottom sheet for Section 2 & 3)
6. "Read full" view (newsletter content display)
7. Skip/save gestures
8. Push notification handling (deep link to gazette)
9. Settings screen

### Phase 4 — Polish (Week 5-6)
1. Error handling (no gazette ready, sync failures, token expiry)
2. Empty states (first day before gazette, no newsletters found)
3. Loading states and skeleton screens
4. Performance optimization (initial sync speed, gazette load time)
5. Privacy policy + terms of service pages
6. App Store / Play Store assets and submission

### ⚠️ CRITICAL: Start Google API verification in Week 1
Gmail readonly scope requires Google verification (4-8 weeks). Submit for verification immediately, don't wait for the app to be finished. Use test/development mode with limited users until verified.

---

## 15. Open Decisions (flag if unclear during implementation)

1. **Bottom sheet vs inline expand** for Section 2/3 cards — default: bottom sheet (more native iOS feel)
2. **Newsletter content rendering** — use WebView for cleaned HTML, not React Native components (faster to implement)
3. **Gazette generation timeout** — if LLM takes > 30s, retry once, then serve partial gazette
4. **Multiple languages** — gazette output language should match newsletter language. If mixed languages in one gazette, default to English. Consider French market support.
5. **Token refresh** — implement silent Google token refresh. If refresh fails, prompt re-auth on next app open
6. **Embedding model** — text-embedding-3-small (1536 dims) is the default. Switch to text-embedding-3-large only if relevance scoring quality is poor
