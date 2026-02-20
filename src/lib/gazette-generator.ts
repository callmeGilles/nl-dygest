import { GoogleGenAI } from "@google/genai";
import { extractReadableContent } from "./summarize";

let _ai: GoogleGenAI | null = null;
function getAI() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _ai;
}

export interface GazetteCandidate {
  id: number;
  sender: string;
  subject: string;
  receivedAt: string;
  contentExcerpt: string;
}

export interface GazetteHeadline {
  newsletterId: number;
  interestTag: string;
  title: string;
  summary: string;
  takeaways: string[];
}

export interface GazetteWorthYourTime {
  newsletterId: number;
  interestTag: string;
  hook: string;
  expandedSummary: string;
  takeaways: string[];
}

export interface GazetteInBrief {
  newsletterId: number;
  interestTag: string;
  oneLiner: string;
  expandedSummary: string;
}

export interface GazetteContent {
  headline: GazetteHeadline;
  worthYourTime: GazetteWorthYourTime[];
  inBrief: GazetteInBrief[];
}

export function buildGazettePrompt(
  candidates: GazetteCandidate[],
  interests: string[]
): string {
  const candidateBlocks = candidates
    .map(
      (c, i) => `--- Newsletter ${i + 1} ---
ID: ${c.id}
From: ${c.sender}
Subject: ${c.subject}
Date: ${c.receivedAt}
Content:
${c.contentExcerpt}
---`
    )
    .join("\n\n");

  return `You are the editor of a personal newsletter gazette. Your job is to select the most valuable newsletters for this reader and present them in a structured briefing.

## Reader Profile
Interests: ${interests.join(", ")}

## Candidate Newsletters (${candidates.length} available)
${candidateBlocks}

## Your Task

Select 7-10 newsletters and assign them to sections:

1. **HEADLINE** (exactly 1): The single most valuable, relevant, and interesting piece today. Pick content that would make the reader glad they opened the gazette.

2. **WORTH YOUR TIME** (2-3): Strong content the reader should consider reading in full. For each, write a HOOK — one sentence that creates curiosity and makes the reader want to tap. Do NOT write a summary. Write a hook. Good: "Stripe just rewrote their entire billing engine — the architectural choices explain why most billing systems fail." Bad: "This newsletter discusses Stripe's billing system changes."

3. **IN BRIEF** (4-6): Content worth knowing about but not worth deep reading today. One sentence each — give the reader the gist.

## Rules
- Ensure topic diversity: don't pick 5 newsletters about the same thing
- Be specific in summaries: names, numbers, concrete claims. Never write "this newsletter discusses..."
- Hooks must create curiosity. Not summaries. Not descriptions.
- If a newsletter is clearly outdated or time-sensitive and expired, skip it
- If fewer than 7 candidates are available, adjust section sizes (minimum: 1 headline + 1-2 others)
- Output valid JSON only. No markdown, no commentary.

## Output Format

{
  "headline": {
    "newsletterId": <number>,
    "interestTag": "<matching interest or general topic>",
    "title": "<compelling title, can be rewritten from subject>",
    "summary": "<3 specific sentences with data points and names>",
    "takeaways": ["<takeaway 1>", "<takeaway 2>", "<takeaway 3>"]
  },
  "worthYourTime": [
    {
      "newsletterId": <number>,
      "interestTag": "<topic>",
      "hook": "<one curiosity-creating sentence>",
      "expandedSummary": "<3-4 sentences with key details>",
      "takeaways": ["<takeaway 1>", "<takeaway 2>"]
    }
  ],
  "inBrief": [
    {
      "newsletterId": <number>,
      "interestTag": "<topic>",
      "oneLiner": "<one sentence gist>",
      "expandedSummary": "<2-3 sentences for optional expanded view>"
    }
  ]
}`;
}

export function parseGazetteResponse(text: string): GazetteContent {
  const parsed = JSON.parse(text);

  if (!parsed.headline || !parsed.headline.newsletterId) {
    throw new Error("Invalid gazette: missing headline");
  }

  return {
    headline: parsed.headline,
    worthYourTime: parsed.worthYourTime || [],
    inBrief: parsed.inBrief || [],
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateGazette(
  candidates: GazetteCandidate[],
  interests: string[]
): Promise<GazetteContent> {
  const prompt = buildGazettePrompt(candidates, interests);

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await getAI().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text ?? "";
      return parseGazetteResponse(text);
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("429") ||
          err.message.includes("RESOURCE_EXHAUSTED") ||
          err.message.includes("503") ||
          err.message.includes("UNAVAILABLE"));
      if (isRetryable && attempt < maxRetries) {
        const delay = (attempt + 1) * 10_000;
        console.log(`Rate limited, retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

export function prepareCandidates(
  newsletters: Array<{
    id: number;
    sender: string;
    subject: string;
    receivedAt: string;
    rawHtml: string;
  }>,
  limit = 30
): GazetteCandidate[] {
  return newsletters.slice(0, limit).map((nl) => ({
    id: nl.id,
    sender: nl.sender,
    subject: nl.subject,
    receivedAt: nl.receivedAt,
    contentExcerpt: extractReadableContent(nl.rawHtml).slice(0, 2000),
  }));
}
