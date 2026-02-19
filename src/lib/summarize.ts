import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;
function getAI() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _ai;
}

export function extractReadableContent(html: string): string {
  const dom = new JSDOM(html, { url: "https://example.com" });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  return article?.textContent || dom.window.document.body?.textContent || "";
}

export function buildSummarizationPrompt(content: string): string {
  return `Analyze this newsletter and return a JSON object with these fields:
- "category": one of "Tech", "Product", "Business", "Design", "Other"
- "headline": a concise headline, max 10 words
- "summary": 2-3 sentence summary
- "key_points": array of 3-5 bullet point strings
- "reading_time": estimated minutes to read the full original

Return ONLY valid JSON, no markdown fences.

Newsletter content:
${content.slice(0, 8000)}`;
}

export interface ArticleSummary {
  category: string;
  headline: string;
  summary: string;
  key_points: string[];
  reading_time: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function summarizeNewsletter(html: string): Promise<ArticleSummary> {
  const content = extractReadableContent(html);
  const prompt = buildSummarizationPrompt(content);

  const maxRetries = 3;
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
      return JSON.parse(text) as ArticleSummary;
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("429") ||
          err.message.includes("RESOURCE_EXHAUSTED") ||
          err.message.includes("503") ||
          err.message.includes("UNAVAILABLE"));
      if (isRetryable && attempt < maxRetries) {
        const delay = (attempt + 1) * 10_000; // 10s, 20s, 30s
        console.log(`Rate limited, retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}
