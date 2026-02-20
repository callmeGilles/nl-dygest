import { describe, it, expect } from "vitest";
import { userInterests } from "@/db/schema";

describe("userInterests table structure", () => {
  it("has the required columns for interest storage", () => {
    const columns = Object.keys(userInterests);
    expect(columns).toContain("sessionId");
    expect(columns).toContain("topic");
    expect(columns).toContain("createdAt");
  });
});
