# Gazette Polish: Performance + UI/UX Improvements

**Status:** Approved
**Date:** 2026-02-19
**Scope:** 4 improvements to the gazette experience

---

## 1. Performance: Sub-60s Generation

### Problem

Gazette generation takes 2-5 minutes. The SSE stream in `src/app/api/gazette/[id]/stream/route.ts` processes newsletters sequentially with a 2-second inter-call delay. For 7 articles: ~7 Gemini calls + 6x2s delays = 30-50s minimum, much more with retries. Additionally, `summarizeNewsletter()` instantiates a new `GoogleGenAI` client on every call.

### Solution

| Change | File | Detail |
|--------|------|--------|
| Singleton GenAI client | `src/lib/summarize.ts` | Move `new GoogleGenAI(...)` to module scope |
| Parallel batched calls | `src/app/api/gazette/[id]/stream/route.ts` | Process newsletters in batches of 3 concurrently |
| Reduce inter-batch delay | Same | 500ms between batches (down from 2s between calls) |

**Batch strategy:** Split newsletter IDs into groups of 3. Process each group with `Promise.allSettled`. Send SSE events as each article completes. 500ms pause between batches. For 7 articles: 3 batches x (Gemini latency + 500ms) = ~15-25s.

**SSE ordering:** Articles may arrive out of order within a batch. The client already handles this (append to array, no assumed order). No client changes needed.

**Rate limit safety:** `gemini-3-flash-preview` has generous rate limits. Batch of 3 is conservative. Existing exponential backoff in `summarizeNewsletter` handles 429s per individual call.

---

## 2. Theme: Cozy Editorial

### Problem

Current palette is cold: pure white background, slate grays, no warmth. Functional but doesn't invite prolonged reading.

### Solution

Replace the cold slate palette with warm stone/amber tones across all gazette components.

**Color token changes (`globals.css` `:root`):**

| Token | Current | New |
|-------|---------|-----|
| `--background` | `oklch(1 0 0)` (pure white) | `oklch(0.97 0.006 83)` (warm cream) |
| `--card` | `oklch(1 0 0)` | `oklch(0.995 0.003 83)` (warm white) |
| `--foreground` | `oklch(0.145 0 0)` (neutral black) | `oklch(0.16 0.012 55)` (warm dark) |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.55 0.01 55)` (warm gray) |
| `--border` | `oklch(0.922 0 0)` | `oklch(0.92 0.008 80)` (warm border) |

**Component-level changes:**

| Element | Current class | New class |
|---------|--------------|-----------|
| Page bg | `bg-slate-50` | `bg-background` (use token) |
| Card bg | `bg-white` | `bg-card` (use token) |
| Primary text | `text-slate-900` | `text-stone-900` |
| Secondary text | `text-slate-500` | `text-stone-500` |
| Muted text | `text-slate-400` | `text-stone-400` |
| Borders | `border-slate-100` | `border-stone-200/60` |
| Card shadow | `shadow-sm` | `shadow-sm shadow-stone-200/50` (warm tint) |

**Category badge warmup:**

| Category | Current | New |
|----------|---------|-----|
| Tech | `bg-blue-50 text-blue-600` | `bg-sky-50 text-sky-700` |
| Product | `bg-purple-50 text-purple-600` | `bg-violet-50 text-violet-700` |
| Business | `bg-green-50 text-green-600` | `bg-emerald-50 text-emerald-700` |
| Design | `bg-pink-50 text-pink-600` | `bg-rose-50 text-rose-700` |
| Other | `bg-slate-50 text-slate-500` | `bg-stone-100 text-stone-500` |

**Files affected:**
- `src/app/globals.css` — theme tokens
- `src/components/gazette-card.tsx` — card colors
- `src/components/article-overlay.tsx` — overlay colors
- `src/components/gazette-header.tsx` — header colors
- `src/components/gazette-loading.tsx` — loading skeleton colors
- `src/app/(app)/gazette/page.tsx` — page background, date text

---

## 3. Animation: Smooth Inline Card Expand

### Problem

The card expand animation stutters. Two issues:
1. `layout` prop on `motion.article` triggers Framer Motion FLIP recalculations that fight with the inner `height: 0 → auto` animation
2. `height: auto` requires Framer to measure the target height mid-animation, causing a layout thrash

### Solution

Remove `layout` from the outer `motion.article`. Replace Framer Motion's `height: 0 → auto` with CSS `grid-template-rows` transition (GPU-composited, no JS measurement).

**Implementation:**

```tsx
// Replace AnimatePresence + motion.div with:
<div
  className="grid transition-[grid-template-rows] duration-200 ease-out"
  style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
>
  <div className="overflow-hidden">
    {/* expanded content */}
  </div>
</div>
```

This approach:
- Uses CSS Grid's `0fr → 1fr` transition (hardware-accelerated)
- No JS layout measurement needed
- Smooth opacity can be layered via a simple CSS `opacity` transition
- Removes dependency on `AnimatePresence` for this component

**Files affected:**
- `src/components/gazette-card.tsx`

---

## 4. Article Overlay: Summary-First Hierarchy

### Problem

The current overlay treats all sections equally. Summary and key points don't stand out. Metadata is inline and easy to miss.

### Solution

Restructure the overlay content with clear visual hierarchy:

1. **Category badge** — small pill, top-left
2. **Headline** — large bold title
3. **Summary card** — hero section with warm background, larger text, distinct from the rest
4. **Metadata bar** — compact row: sender | date | reading time, with subtle icon accents, slightly elevated with a different background
5. **Key points card** — distinct section with numbered or bulleted items, slightly indented, warm accent left-border
6. **Divider**
7. **Full newsletter** — existing prose rendering

**Visual treatments:**
- Summary: `bg-stone-50 rounded-lg p-4` with `text-base leading-relaxed`
- Metadata bar: `bg-stone-50/50 rounded-lg px-4 py-3` with icons for sender, calendar, clock
- Key points: left border accent `border-l-2 border-amber-300 pl-4`

**Files affected:**
- `src/components/article-overlay.tsx`

---

## Files Modified (Complete List)

| File | Changes |
|------|---------|
| `src/lib/summarize.ts` | Singleton GenAI client |
| `src/app/api/gazette/[id]/stream/route.ts` | Batched parallel processing |
| `src/app/globals.css` | Warm theme tokens |
| `src/components/gazette-card.tsx` | Warm colors, CSS grid animation |
| `src/components/article-overlay.tsx` | Warm colors, summary-first layout |
| `src/components/gazette-header.tsx` | Warm colors |
| `src/components/gazette-loading.tsx` | Warm colors |
| `src/app/(app)/gazette/page.tsx` | Use theme tokens for page bg/text |
