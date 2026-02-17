import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import Anthropic from "@anthropic-ai/sdk";

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

export async function summarizeNewsletter(html: string): Promise<ArticleSummary> {
  const content = extractReadableContent(html);
  const prompt = buildSummarizationPrompt(content);

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return JSON.parse(text) as ArticleSummary;
}
