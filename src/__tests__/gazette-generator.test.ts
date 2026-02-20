import { describe, it, expect } from "vitest";
import { buildGazettePrompt, parseGazetteResponse } from "@/lib/gazette-generator";

const mockCandidates = [
  {
    id: 1,
    sender: "Lenny Rachitsky <lenny@substack.com>",
    subject: "Why onboarding fails",
    receivedAt: "2026-02-19T10:00:00Z",
    contentExcerpt: "Analysis of 50+ B2B SaaS companies shows...",
  },
  {
    id: 2,
    sender: "Gergely Orosz <gergely@pragmaticengineer.com>",
    subject: "Stripe's billing rewrite",
    receivedAt: "2026-02-18T10:00:00Z",
    contentExcerpt: "Stripe spent 3 years rewriting their billing engine...",
  },
];

const mockInterests = ["Product Management", "Engineering", "AI"];

describe("buildGazettePrompt", () => {
  it("includes user interests in the prompt", () => {
    const prompt = buildGazettePrompt(mockCandidates, mockInterests);
    expect(prompt).toContain("Product Management");
    expect(prompt).toContain("Engineering");
    expect(prompt).toContain("AI");
  });

  it("includes candidate newsletter data", () => {
    const prompt = buildGazettePrompt(mockCandidates, mockInterests);
    expect(prompt).toContain("Lenny Rachitsky");
    expect(prompt).toContain("Stripe's billing rewrite");
  });

  it("includes section instructions", () => {
    const prompt = buildGazettePrompt(mockCandidates, mockInterests);
    expect(prompt).toContain("HEADLINE");
    expect(prompt).toContain("WORTH YOUR TIME");
    expect(prompt).toContain("IN BRIEF");
  });
});

describe("parseGazetteResponse", () => {
  it("parses a valid gazette JSON response", () => {
    const json = JSON.stringify({
      headline: {
        newsletterId: 1,
        interestTag: "Product",
        title: "Test headline",
        summary: "Test summary sentence one. Two. Three.",
        takeaways: ["Point 1", "Point 2"],
      },
      worthYourTime: [
        {
          newsletterId: 2,
          interestTag: "Engineering",
          hook: "A compelling hook.",
          expandedSummary: "Longer summary here.",
          takeaways: ["Point 1"],
        },
      ],
      inBrief: [],
    });

    const result = parseGazetteResponse(json);
    expect(result.headline.title).toBe("Test headline");
    expect(result.worthYourTime).toHaveLength(1);
    expect(result.worthYourTime[0].hook).toBe("A compelling hook.");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseGazetteResponse("not json")).toThrow();
  });
});
