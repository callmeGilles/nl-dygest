import { describe, it, expect } from "vitest";
import { extractReadableContent, buildSummarizationPrompt } from "../summarize";

describe("extractReadableContent", () => {
  it("should extract text from HTML", () => {
    const html = `
      <html><body>
        <h1>Weekly Tech Digest</h1>
        <p>Here are the top stories this week.</p>
        <ul><li>Story one</li><li>Story two</li></ul>
      </body></html>
    `;
    const result = extractReadableContent(html);
    expect(result).toContain("Weekly Tech Digest");
    expect(result).toContain("top stories");
  });
});

describe("buildSummarizationPrompt", () => {
  it("should return a prompt with the newsletter content", () => {
    const content = "This is a newsletter about TypeScript features.";
    const prompt = buildSummarizationPrompt(content);
    expect(prompt).toContain("TypeScript features");
    expect(prompt).toContain("category");
    expect(prompt).toContain("headline");
    expect(prompt).toContain("summary");
    expect(prompt).toContain("key_points");
  });
});
