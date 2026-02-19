import { describe, it, expect } from "vitest";
import { selectRandomNewsletters } from "@/lib/newsletters";

describe("selectRandomNewsletters", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    gmailId: `msg-${i}`,
    sender: `sender-${i}`,
    subject: `subject-${i}`,
    snippet: "",
    receivedAt: new Date().toISOString(),
    rawHtml: "<p>content</p>",
  }));

  it("returns between min and max items", () => {
    const result = selectRandomNewsletters(items, 5, 10);
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns all items if fewer than min available", () => {
    const few = items.slice(0, 3);
    const result = selectRandomNewsletters(few, 5, 10);
    expect(result).toHaveLength(3);
  });

  it("returns items from the input array", () => {
    const result = selectRandomNewsletters(items, 5, 10);
    for (const item of result) {
      expect(items).toContainEqual(item);
    }
  });

  it("returns no duplicates", () => {
    const result = selectRandomNewsletters(items, 10, 10);
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
