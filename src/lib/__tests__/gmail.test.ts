import { describe, it, expect } from "vitest";
import { getAuthUrl } from "../gmail";

describe("Gmail OAuth", () => {
  it("should generate an auth URL with correct scopes", () => {
    const url = getAuthUrl();
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("gmail.modify");
    expect(url).toContain("redirect_uri");
  });
});
