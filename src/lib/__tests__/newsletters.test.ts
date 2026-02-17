import { describe, it, expect } from "vitest";
import { parseGmailMessage } from "../newsletters";

describe("parseGmailMessage", () => {
  it("should extract sender, subject, snippet from Gmail message", () => {
    const gmailMessage = {
      id: "msg_001",
      payload: {
        headers: [
          { name: "From", value: "Lenny <lenny@substack.com>" },
          { name: "Subject", value: "Why onboarding is broken" },
          { name: "Date", value: "Mon, 10 Feb 2026 08:00:00 +0000" },
        ],
        body: { data: "" },
        parts: [
          {
            mimeType: "text/html",
            body: {
              data: Buffer.from("<p>Hello world</p>").toString("base64url"),
            },
          },
        ],
      },
      snippet: "Hello world preview text",
    };

    const result = parseGmailMessage(gmailMessage);

    expect(result.gmailId).toBe("msg_001");
    expect(result.sender).toBe("Lenny <lenny@substack.com>");
    expect(result.subject).toBe("Why onboarding is broken");
    expect(result.snippet).toBe("Hello world preview text");
    expect(result.rawHtml).toContain("<p>Hello world</p>");
  });

  it("should handle messages with nested parts", () => {
    const gmailMessage = {
      id: "msg_002",
      payload: {
        headers: [
          { name: "From", value: "sender@test.com" },
          { name: "Subject", value: "Test" },
          { name: "Date", value: "Tue, 11 Feb 2026 10:00:00 +0000" },
        ],
        body: { data: "" },
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              {
                mimeType: "text/html",
                body: {
                  data: Buffer.from("<h1>Nested</h1>").toString("base64url"),
                },
              },
            ],
          },
        ],
      },
      snippet: "Nested preview",
    };

    const result = parseGmailMessage(gmailMessage);
    expect(result.rawHtml).toContain("<h1>Nested</h1>");
  });
});
